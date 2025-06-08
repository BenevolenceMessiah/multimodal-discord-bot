import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  ChatInputCommandInteraction,
} from 'discord.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';
import { pushMessage as pushToMemory } from '../services/context.js';
import { pushMessage, getContext } from '../services/cache.js';
import { splitMessage } from './utils/messageUtils.js';

/* ─── Command registrations ─── */
import { data as imgData, execute as imgExec } from '../commands/img.js';
import { data as sayData, execute as sayExec } from '../commands/say.js';
import { data as webData, execute as webExec } from '../commands/web.js';
import { data as threadData, execute as threadExec } from '../commands/thread.js';
import { data as threadPrivData, execute as threadPrivExec } from '../commands/threadPrivate.js';
import { data as clearData, execute as clearExec } from '../commands/clear.js';

/* ─── Services ─── */
import { logInteraction } from '../services/db.js';
import { generateText } from '../services/llm.js';

type CmdHandler = (i: ChatInputCommandInteraction) => Promise<void>;

const commands = [
  imgData,
  sayData,
  webData,
  threadData,
  threadPrivData,
  clearData,
];

const handlers = new Collection<string, CmdHandler>([
  ['img', imgExec],
  ['say', sayExec],
  ['web', webExec],
  ['thread', threadExec],
  ['thread-private', threadPrivExec],
  ['clear', clearExec],
]);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  if (client.user) {
    logger.info(`Logged in as ${client.user.tag}`);
  } else {
    logger.error('Client user is null on ready event.');
  }
});

/* ─── Slash-command dispatcher ─── */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const start = Date.now();
  const handler = handlers.get(interaction.commandName);
  
  if (!handler) {
    logger.warn(`No handler found for command: ${interaction.commandName}`);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Unknown command.', ephemeral: true });
      } else {
        await interaction.editReply({ content: '❌ Unknown command.' });
      }
    } catch (e) {
      logger.error(`Error replying to unknown command: ${e}`);
    }
    return;
  }

  try {
    await handler(interaction);
    if (config.postgres?.enabled) {
      await logInteraction(
        interaction.guildId ?? 'dm',
        interaction.user.id,
        interaction.commandName,
        Date.now() - start,
      );
    }
  } catch (err: any) {
    logger.error(`Error executing command ${interaction.commandName}: ${err.message || err}`);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: '❌ Error executing command.' }).catch(e => logger.error(`Failed to edit reply on error: ${e}`));
    } else {
      await interaction.reply({ content: '❌ Error executing command.', ephemeral: true }).catch(e => logger.error(`Failed to reply on error: ${e}`));
    }
  }
});

/* ─── Wake-word, @mention, and DM listener ─── */
client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !client.user) return;

  const isDM = !msg.guild;
  const mentioned = msg.mentions.has(client.user.id);
  const wakeWordUsed = config.wakeWords.some((w) =>
    msg.content.toLowerCase().includes(w.toLowerCase()),
  );

  if (!isDM && !mentioned && !wakeWordUsed) return;

  let userPrompt = msg.content;

  // Clean up prompt
  if (mentioned) {
    userPrompt = userPrompt.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  }
  if (wakeWordUsed && !isDM) {
    config.wakeWords.forEach((w) => {
      const wakeWordPattern = new RegExp(`(^|\\s)${w}(\\s|$)`, 'gi');
      userPrompt = userPrompt.replace(wakeWordPattern, ' ').trim();
    });
  }
  userPrompt = userPrompt.replace(/\s+/g, ' ').trim();

  if (!userPrompt && msg.attachments.size > 0) {
    userPrompt = "[Attachment content]";
  }
  
  if (!userPrompt) {
    logger.info(`Interaction from ${msg.author.tag} in ${isDM ? 'DM' : msg.channel.id} resulted in empty prompt after cleaning. Original: "${msg.content}"`);
    if (isDM || mentioned) {
      await msg.reply("How can I help you?").catch(e => logger.error(`Failed to send default reply: ${e}`));
    }
    return;
  }

  try {
    await msg.channel.sendTyping();

    // Push user message with username prefix
    if (config.redis?.enabled) {
      await pushMessage(msg.channelId, msg.author.username, userPrompt);
    } else {
      pushToMemory(msg.channelId, msg.author.username, userPrompt);
    }
    
    // Retrieve context including username prefixes
    let context: string;
    if (config.redis?.enabled) {
      // Redis branch (async)
      context = await getContext(msg.channelId);    // string
    } else {
      // In-memory branch (was sync but returns string anyway)
      context = await getContext(msg.channelId);    // string
    }

logger.info(`Generating LLM response for ${msg.author.tag}. Prompt: "${userPrompt}". Context length: ${context.split('\n').length} lines.`);

const reply = await generateText(context);
    
    if (reply) {
      // Push bot response with bot's username
      if (config.redis?.enabled) {
        await pushMessage(msg.channelId, client.user.username, reply);
      } else {
        pushToMemory(msg.channelId, client.user.username, reply);
      }

      // Split long responses into Discord-safe chunks
      const chunks = splitMessage(reply, 1800);
      
      // Send first chunk as reply
      await msg.reply(chunks[0]);
      
      // Send remaining chunks as follow-ups
      for (let i = 1; i < chunks.length; i++) {
        await msg.channel.send(chunks[i]);
      }
    } else {
      logger.warn(`LLM generated an empty reply for prompt: "${userPrompt}"`);
      await msg.reply("I couldn't come up with a response for that.");
    }
  } catch (error: any) {
    logger.error(`Error in messageCreate LLM handler: ${error.message || error} for prompt: "${userPrompt}"`);
    await msg.reply("Sorry, I encountered an error trying to respond - But aren't you happy I can at least respond like this? Haha, isn't this amusing?").catch(e => logger.error(`Failed to send error reply: ${e}`));
  }
});

/* ─── Register slash-commands & start ─── */
(async () => {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    logger.error("Missing DISCORD_TOKEN or CLIENT_ID in environment");
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    logger.info('Refreshing application commands');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map((c) => c.toJSON()) },
    );
    logger.info('Successfully reloaded application commands');
  } catch (error) {
    logger.error('Failed to reload application commands:', error);
  }

  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    logger.error('Failed to log in to Discord:', error);
    process.exit(1);
  }
})();
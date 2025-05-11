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

/* ─── Command registrations ─── */
import { data as imgData, execute as imgExec } from '../commands/img.js';
import { data as sayData, execute as sayExec } from '../commands/say.js'; // say.ts is now an echo command
import { data as webData, execute as webExec } from '../commands/web.js';
import { data as threadData, execute as threadExec } from '../commands/thread.js';
import { data as threadPrivData, execute as threadPrivExec } from '../commands/threadPrivate.js';
import { data as clearData, execute as clearExec } from '../commands/clear.js';

/* ─── Event Handlers ─── */
// The file 'bot/src/events/messageCreate.ts' was not used, handler is inline below.

/* ─── Services ─── */
import { pushMessage, getContext } from '../services/cache.js'; // Using Redis cache for context
import { logInteraction } from '../services/db.js';
import { generateText } from '../services/llm.js';

/* ─── Command map ─── */
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

/* ─── Discord client ─── */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,   // CRITICAL: Ensure this is enabled in Discord Dev Portal
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,   // For DMs
  ],
  partials: [Partials.Channel],         // Useful for DM channel events
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
    // Logging interaction to DB (if enabled)
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
  if (msg.author.bot || !client.user) return; // Ignore bot messages and ensure client.user is available

  const isDM = !msg.guild;
  const mentioned = msg.mentions.has(client.user.id);
  const wakeWordUsed = config.wakeWords.some((w) =>
    msg.content.toLowerCase().includes(w.toLowerCase()),
  );

  if (!isDM && !mentioned && !wakeWordUsed) return; // Must be a DM, mention, or use a wake word

  let userPrompt = msg.content;

  // Clean up prompt
  if (mentioned) {
    userPrompt = userPrompt.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  }
  if (wakeWordUsed && !isDM) { // Avoid over-stripping in DMs or if also mentioned
    config.wakeWords.forEach((w) => {
      // More careful replace to avoid issues if wake words are substrings of actual content
      // This regex tries to match wake words as whole words or at start/end of lines.
      const wakeWordPattern = new RegExp(`(^|\\s)${w}(\\s|$)`, 'gi');
      userPrompt = userPrompt.replace(wakeWordPattern, ' ').trim(); // Replace with space then trim
    });
  }
  userPrompt = userPrompt.replace(/\s+/g, ' ').trim(); // Normalize multiple spaces

  if (!userPrompt && msg.attachments.size > 0) {
    userPrompt = "[User sent an attachment, image, or embedded content]"; // Placeholder for non-text content
  }
  
  if (!userPrompt) {
    logger.info(`Interaction from ${msg.author.tag} in ${isDM ? 'DM' : msg.channel.id} resulted in empty prompt after cleaning. Original: "${msg.content}"`);
    // Optionally, reply if it was a direct interaction like a mention or DM without content
    if (isDM || mentioned) {
        await msg.reply("How can I help you?").catch(e => logger.error(`Failed to send default reply: ${e}`));
    }
    return;
  }

  try {
    await msg.channel.sendTyping();

    await pushMessage(msg.channelId, `${msg.author.username}: ${userPrompt}`);
    const context = await getContext(msg.channelId); // Ensure context includes the latest message
    
    logger.info(`Generating LLM response for ${msg.author.tag}. Prompt: "${userPrompt}". Context length: ${context.split('\n').length} lines.`);
    const reply = await generateText(context); // Pass the full context
    
    if (reply) {
      await pushMessage(msg.channelId, `Bot: ${reply}`);
      await msg.reply(reply);
    } else {
      logger.warn(`LLM generated an empty reply for prompt: "${userPrompt}"`);
      await msg.reply("I couldn't come up with a response for that.");
    }
  } catch (error: any) {
    logger.error(`Error in messageCreate LLM handler: ${error.message || error} for prompt: "${userPrompt}"`);
    await msg.reply("Sorry, I encountered an error trying to respond.").catch(e => logger.error(`Failed to send error reply: ${e}`));
  }
});

/* ─── Register slash-commands & start ─── */
(async () => {
  if (!process.env.DISCORD_TOKEN) {
    logger.error("DISCORD_TOKEN is not set in .env file.");
    process.exit(1);
  }
  if (!process.env.CLIENT_ID) {
    logger.error("CLIENT_ID is not set in .env file.");
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    logger.info('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map((c) => c.toJSON()) },
    );
    logger.info('Successfully reloaded application (/) commands.');
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
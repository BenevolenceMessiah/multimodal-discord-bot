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
import { data as sayData, execute as sayExec } from '../commands/say.js';
import { data as webData, execute as webExec } from '../commands/web.js';
import { data as threadData, execute as threadExec } from '../commands/thread.js';
import { data as threadPrivData, execute as threadPrivExec } from '../commands/threadPrivate.js';
import { data as clearData, execute as clearExec } from '../commands/clear.js';

/* ─── Services ─── */
import { pushMessage, getContext } from '../services/cache.js';
import { logInteraction } from '../services/db.js';
import { generateText } from '../services/llm.js';

/* ─── Command map ─── */

// Use ChatInputCommandInteraction instead of Interaction for better typing
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  logger.info(`Logged in as ${client.user?.tag}`);
});

/* ─── Slash-command dispatcher ─── */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const start = Date.now();
  const handler = handlers.get(interaction.commandName);
  if (!handler) return;

  try {
    await handler(interaction);
    await logInteraction(
      interaction.guildId ?? 'dm',
      interaction.user.id,
      interaction.commandName,
      Date.now() - start,
    );
  } catch (err) {
    logger.error(err);
    if (!interaction.replied) {
      await interaction.reply({
        content: '❌ Error executing command',
        ephemeral: true,
      });
    }
  }
});

/* ─── Wake-word listener ─── */
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const mentioned = msg.mentions.has(client.user!.id);
  const wake = config.wakeWords.some((w) =>
    msg.content.toLowerCase().includes(w.toLowerCase()),
  );
  if (!(mentioned || wake)) return;

  await pushMessage(msg.channelId, `${msg.author.username}: ${msg.content}`);
  const context = await getContext(msg.channelId);
  const reply = await generateText(context);
  await pushMessage(msg.channelId, `Bot: ${reply}`);
  await msg.reply(reply);
});

/* ─── Register slash-commands & start ─── */
(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
    body: commands.map((c) => c.toJSON()),
  });
  logger.info('Registered slash commands');

  await client.login(process.env.DISCORD_TOKEN);
})();
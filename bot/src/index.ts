import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  Interaction,
} from 'discord.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';

// Command registrations
import { data as imgData, execute as imgExec } from './commands/img.js';
import { data as sayData, execute as sayExec } from './commands/say.js';
import { data as webData, execute as webExec } from './commands/web.js';
import { data as threadData, execute as threadExec } from './commands/thread.js';
import { data as threadPrivData, execute as threadPrivExec } from './commands/threadPrivate.js';
import { data as clearData, execute as clearExec } from './commands/clear.js';

// Services
import { pushMessage, getContext, clearContext } from './services/cache.js';
import { logInteraction } from './services/db.js';
import { generateText } from './services/llm.js';

// Build command maps
type CmdHandler = (interaction: Interaction) => Promise<void>;
const commands = [
  imgData,
  sayData,
  webData,
  threadData,
  threadPrivData,
  clearData,
];
const handlers = new Collection<string, CmdHandler>([
  ['img', imgExec as any],
  ['say', sayExec as any],
  ['web', webExec as any],
  ['thread', threadExec as any],
  ['thread-private', threadPrivExec as any],
  ['clear', clearExec as any],
]);

// Initialize Discord client
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

// Slash-command handling
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const start = Date.now();
  const handler = handlers.get(interaction.commandName);
  if (!handler) return;
  try {
    await handler(interaction);
    const latency = Date.now() - start;
    await logInteraction(
      interaction.guildId ?? 'dm',
      interaction.user.id,
      interaction.commandName,
      latency
    );
  } catch (e: any) {
    logger.error(e);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Error executing command', ephemeral: true });
    }
  }
});

// Mention & wake-word chat handling
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const mentioned = msg.mentions.has(client.user!.id);
  const wake = config.wakeWords.some((w) => msg.content.toLowerCase().includes(w.toLowerCase()));
  if (!(mentioned || wake)) return;

  await pushMessage(msg.channelId, `${msg.author.username}: ${msg.content}`);
  const context = await getContext(msg.channelId);
  const reply = await generateText(context);
  await pushMessage(msg.channelId, `Bot: ${reply}`);
  await msg.reply(reply);
});

// Register and start
overall:
(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
    body: commands.map((cmd) => cmd.toJSON()),
  });
  logger.info('Registered slash commands');
  await client.login(process.env.DISCORD_TOKEN);
})();
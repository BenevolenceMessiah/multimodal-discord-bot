/* ────────────────────────────── index.ts ──────────────────────────────
 * Discord bot main entry-point
 * ------------------------------------------------------------------- */

import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  ChatInputCommandInteraction,
  TextBasedChannel,
} from 'discord.js';
import fs   from 'node:fs';          // 👈 NEW  (needed for fs.readdirSync)
import path from 'node:path';

/* ── ESM-safe __dirname / __filename polyfill ──────────────────────── */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));

import { logger }  from './utils/logger.js';
import { config }  from './config.js';

/* Context / memory -------------------------------------------------- */
import { pushMessage as pushToMemory } from '../services/context.js';
import { pushMessage, getContext }    from '../services/cache.js';

/* Utilities --------------------------------------------------------- */
import { formatToolCallLine } from './utils/formatToolCall.js';
import { withTyping, splitMessage }   from './utils/messageUtils.js';
import { tryHandleToolCall }         from './utils/toolCallRouter.js';
import { stripThought }              from './utils/stripThought.js';
import { splitByToolCalls }          from './utils/splitByToolCalls.js';

/* Slash-command modules -------------------------------------------- */
import { data as imgData,    execute as imgExec }    from '../commands/img.js';
import { data as sayData,    execute as sayExec }    from '../commands/say.js';
import { data as webData,    execute as webExec }    from '../commands/web.js';
import { data as musicData,  execute as musicExec }  from '../commands/music.js';
import { data as threadData, execute as threadExec } from '../commands/thread.js';
import { data as threadPrivData, execute as threadPrivExec } from '../commands/threadPrivate.js';
import { data as clearData,  execute as clearExec }  from '../commands/clear.js';
import { data as lorasData, execute as lorasExec } from "../commands/loras.js";

/* Services --------------------------------------------------------- */
import { logInteraction } from '../services/db.js';
import { generateText }   from '../services/llm.js';

/* ---------------- registered slash commands ----------------------- */
const commands = [
  imgData, sayData, webData, musicData, threadData, threadPrivData, clearData, lorasData,
];
type CmdHandler = (i: ChatInputCommandInteraction) => Promise<void>;
const handlers = new Collection<string, CmdHandler>([
  ['img',            imgExec],
  ['say',            sayExec],
  ['web',            webExec],
  ['music',          musicExec],
  ['thread',         threadExec],
  ['thread-private', threadPrivExec],
  ['clear',          clearExec],
  ["loras", lorasExec],
  ] as Iterable<[string, CmdHandler]>
);

/* ─── Discord client bootstrap ─────────────────────────────────────── */

/** Augment the Client type so TS is happy with `.commands` */
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, CmdHandler>;
  }
}

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

/* attach the command map */
client.commands = handlers; // pattern from the official guide

client.once('ready', () => {
  client.user
    ? logger.info(`✅ Logged in as ${client.user.tag}`)
    : logger.error('🚨 Client user is null on ready event.');
});

/* ─── Dynamic event loader (e.g. autocomplete listener) ───────────── */

const candidateDirs = [
  path.join(__dirname, 'events'),        // dist/src/events  (TS keeps src tree)
  path.join(__dirname, '../events'),     // dist/events      (flat build)
];

for (const eventsPath of candidateDirs) {
  if (!fs.existsSync(eventsPath)) continue;          // ⬅️ skip if directory absent
  for (const file of fs.readdirSync(eventsPath)) {
    if (!file.endsWith('.js')) continue;
    import(path.join(eventsPath, file))
      .then(({ name, execute }) => client.on(name, execute))
      .catch((e) => logger.error(`Failed loading event ${file}: ${e}`));
  }
}

/* ───────────────────── slash-command dispatcher ──────────────────── */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const start = Date.now();
  const handler = handlers.get(interaction.commandName);

  if (!handler) {
    logger.warn(`No handler for /${interaction.commandName}`);
    const payload = { content: '❌ Unknown command.' };
    try {
      interaction.replied || interaction.deferred
        ? await interaction.editReply(payload)
        : await interaction.reply({ ...payload, ephemeral: true });
    } catch (e) { logger.error(`Unknown-cmd reply failed: ${e}`); }
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
    logger.error(`Error in /${interaction.commandName}: ${err.message ?? err}`);
    const payload = { content: '❌ Error executing command.' };
    interaction.replied || interaction.deferred
      ? await interaction.editReply(payload).catch(e => logger.error(`Edit-reply fail: ${e}`))
      : await interaction.reply({ ...payload, ephemeral: true })
          .catch(e => logger.error(`Reply-on-error fail: ${e}`));
  }
});

/* ─────────────────────────── message router ──────────────────────── */
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;

  /* tool-call short-circuit */
  if (await tryHandleToolCall(msg.content, msg.channel)) return;

  if (!client.user) return;
  const botUser = client.user;

  const isDM         = !msg.guild;
  const mentioned    = msg.mentions.has(botUser.id);
  const wakeWordUsed = Array.isArray(config.wakeWords)
    ? config.wakeWords.some(w => msg.content.toLowerCase().includes(w.toLowerCase()))
    : msg.content.toLowerCase().includes(String(config.wakeWords).toLowerCase());

  if (!isDM && !mentioned && !wakeWordUsed) return;

  /* clean user prompt ------------------------------------------------ */
  let userPrompt = msg.content;
  if (mentioned)
    userPrompt = userPrompt.replace(new RegExp(`<@!?${botUser.id}>`, 'g'), '').trim();

  if (wakeWordUsed && !isDM) {
    const pattern = Array.isArray(config.wakeWords)
      ? config.wakeWords.map(w => `(^|\\s)${w}(\\s|$)`).join('|')
      : `(^|\\s)${config.wakeWords}(\\s|$)`;
    userPrompt = userPrompt.replace(new RegExp(pattern, 'gi'), ' ').trim();
  }

  if (!userPrompt && msg.attachments.size > 0) userPrompt = '[Attachment content]';
  if (!userPrompt) {
    logger.info(`Empty prompt from ${msg.author.tag}.`);
    if (isDM || mentioned)
      await msg.reply('How can I help you?')
        .catch(e => logger.error(`Default-reply fail: ${e}`));
    return;
  }

  /* LLM orchestration ------------------------------------------------ */
  try {
    await withTyping(msg.channel as TextBasedChannel, async () => {
      /* 1️⃣ store prompt */
      config.redis?.enabled
        ? await pushMessage(msg.channelId, msg.author.username, userPrompt)
        : pushToMemory(msg.channelId, msg.author.username, userPrompt);

      /* 2️⃣ context */
      const context = await getContext(msg.channelId);
      logger.info(
        `LLM > ${msg.author.tag} | prompt "${userPrompt}" (${context.split('\n').length} ctx lines)`,
      );

      /* 3️⃣ model reply */
      const rawReply = await generateText(context);

      /* 4️⃣ unwrap */
      const cleanFull = extractResponseContent(rawReply, botUser.username);

      /* 5️⃣ split tool calls */
      const { textBefore, calls, textAfter } = splitByToolCalls(cleanFull);

      const before = config.hideThoughtProcess ? stripThought(textBefore) : textBefore;
      const after  = config.hideThoughtProcess ? stripThought(textAfter)  : textAfter;

      /* 6️⃣ lead-in narration */
      if (before) {
        const chunks = splitMessage(before, 1_800);
        await msg.reply(chunks[0]);
        for (const extra of chunks.slice(1)) await msg.channel.send(extra);
        saveBotMsg(msg.channelId, botUser.username, before);
      }

      /* 6️⃣-b early exit */
      if (calls.length === 0) {
        if (after) saveBotMsg(msg.channelId, botUser.username, after);
        return;
      }

      /* 6️⃣-c pretty tool-call lines */
      for (const raw of calls) {
        const pretty = formatToolCallLine(raw);
        await msg.channel.send(pretty);
        saveBotMsg(msg.channelId, botUser.username, pretty);
      }

      /* 7️⃣ execute calls */
      for (const line of calls) {
        await tryHandleToolCall(line, msg.channel);
        await msg.channel.send('🤖 *Tool execution complete!*');
      }

      /* 8️⃣ trailing text */
      if (after) {
        const chunks = splitMessage(after, 1_800);
        await msg.channel.send(chunks[0]);
        for (const extra of chunks.slice(1)) await msg.channel.send(extra);
        saveBotMsg(msg.channelId, botUser.username, after);
      }

      /* 9️⃣ nothing but calls? still persist */
      if (!before && !after && calls.length)
        saveBotMsg(msg.channelId, botUser.username, '[executed tool call]');
    });
  } catch (err: any) {
    logger.error(`Message handler error: ${err.message ?? err}`);
    await msg.reply(
      'Sorry, I hit a snag while responding. Please try again shortly.',
    ).catch(e => logger.error(`Fail sending error-reply: ${e}`));
  }
});

/* ────────────────── slash-command registration & login ───────────── */
(async () => {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    logger.error('Missing DISCORD_TOKEN or CLIENT_ID env vars');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    logger.info('🔃 Refreshing application commands…');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map(c => c.toJSON()) },
    );
    logger.info('✅ Application commands reloaded.');
  } catch (err) { logger.error('Command refresh failed:', err); }

  try { await client.login(process.env.DISCORD_TOKEN); }
  catch (err) {
    logger.error('Discord login failed:', err);
    process.exit(1);
  }
})();

/* ──────────────────────────── helpers ─────────────────────────────── */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractResponseContent(full: string, botName: string): string {
  const START = '<final_response>';
  const END   = '</final_response>';
  const raw =
    full.includes(START) && full.includes(END) && full.indexOf(START) < full.indexOf(END)
      ? full.slice(full.indexOf(START) + START.length, full.indexOf(END))
      : full;
  return raw.replace(new RegExp(`^${escapeRegex(botName)}:\\s*`, 'i'), '').trim();
}

function saveBotMsg(channelId: string, botName: string, text: string): void {
  if (!text) return;
  config.redis?.enabled
    ? pushMessage(channelId, botName, text)
    : pushToMemory(channelId, botName, text);
}

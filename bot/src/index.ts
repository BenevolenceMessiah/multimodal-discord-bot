/* ────────────────────────────── index.ts ──────────────────────────────
 * Discord bot main entry-point
 * ------------------------------------------------------------------- */

import 'dotenv/config';
import {
  Client, GatewayIntentBits, Partials, Collection, REST, Routes,
  ChatInputCommandInteraction, TextBasedChannel, AttachmentBuilder,
} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));

import { logger }  from './utils/logger.js';
import { config }  from './config.js';

/* Context / memory */
import { pushMessage as pushToMemory } from '../services/context.js';
import { pushMessage, getContext }    from '../services/cache.js';

/* Utilities */
import { formatToolCallLine } from './utils/formatToolCall.js';
import { withTyping, splitMessage }   from './utils/messageUtils.js';
import { tryHandleToolCall }         from './utils/toolCallRouter.js';
import { stripThought }              from './utils/stripThought.js';
import { splitByToolCalls }          from './utils/splitByToolCalls.js';
import { convertWavToMp3 }           from './utils/audio.js';

/* Slash-command modules */
import { data as imgData,    execute as imgExec }    from '../commands/img.js';
import { data as sayData,    execute as sayExec }    from '../commands/say.js';
import { data as webData,    execute as webExec }    from '../commands/web.js';
import { data as musicData,  execute as musicExec }  from '../commands/music.js';
import { data as threadData, execute as threadExec } from '../commands/thread.js';
import { data as threadPrivData, execute as threadPrivExec } from '../commands/threadPrivate.js';
import { data as clearData,  execute as clearExec }  from '../commands/clear.js';
import { data as lorasData, execute as lorasExec }   from '../commands/loras.js';
import { data as speakData, execute as speakExec }   from '../commands/speak.js';
import { data as ttsSvcData, execute as ttsSvcExec } from '../commands/ttsService.js';

/* Services */
import { logInteraction } from '../services/db.js';
import { generateText }   from '../services/llm.js';
import { synthesize }     from '../services/tts.js';
import { getTTSMode }     from '../services/ttsMode.js';

/* ---------------- slash-command registry --------------------------- */
const commands = [
  imgData, sayData, webData, musicData, threadData,
  threadPrivData, clearData, lorasData, speakData, ttsSvcData,
];
type CmdHandler = (i: ChatInputCommandInteraction) => Promise<void>;
const handlers = new Collection<string, CmdHandler>([
  ['img', imgExec], ['say', sayExec], ['web', webExec], ['music', musicExec],
  ['thread', threadExec], ['thread-private', threadPrivExec],
  ['clear', clearExec], ['loras', lorasExec],
  ['speak', speakExec], ['tts-service', ttsSvcExec],
] as Iterable<[string, CmdHandler]>);

/* ---------------- Discord client bootstrap ------------------------ */
declare module 'discord.js' { interface Client { commands: Collection<string, CmdHandler>; } }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});
client.commands = handlers;

client.once('ready', () => {
  client.user
    ? logger.info(`✅ Logged in as ${client.user.tag}`)
    : logger.error('🚨 Client user is null on ready event.');
});

/* dynamic event loader (supports hot builds) */
for (const p of [path.join(__dirname, 'events'), path.join(__dirname, '../events')]) {
  if (!fs.existsSync(p)) continue;
  for (const f of fs.readdirSync(p)) {
    if (!f.endsWith('.js')) continue;
    import(path.join(p, f))
      .then(({ name, execute }) => client.on(name, execute))
      .catch(e => logger.error(`Failed loading event ${f}: ${e}`));
  }
}

/* ---------------- interaction dispatcher -------------------------- */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const start = Date.now();
  const handler = handlers.get(interaction.commandName);
  if (!handler) {
    const payload = { content: '❌ Unknown command.' };
    interaction.replied || interaction.deferred
      ? await interaction.editReply(payload).catch(() => {})
      : await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
    return;
  }
  try {
    await handler(interaction);
    if (config.postgres?.enabled)
      await logInteraction(interaction.guildId ?? 'dm',
        interaction.user.id, interaction.commandName, Date.now() - start);
  } catch (e: any) {
    logger.error(`Error in /${interaction.commandName}: ${e.message ?? e}`);
    const payload = { content: '❌ Error executing command.' };
    interaction.replied || interaction.deferred
      ? await interaction.editReply(payload).catch(() => {})
      : await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
  }
});

/* ---------------- message router ---------------------------------- */
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (await tryHandleToolCall(msg.content, msg.channel)) return;
  if (!client.user) return;

  const botUser = client.user;
  const isDM      = !msg.guild;
  const mentioned = msg.mentions.has(botUser.id);
  const wakeWord  = Array.isArray(config.wakeWords)
    ? config.wakeWords.some(w => msg.content.toLowerCase().includes(w.toLowerCase()))
    : msg.content.toLowerCase().includes(String(config.wakeWords).toLowerCase());
  if (!isDM && !mentioned && !wakeWord) return;

  /* strip mention / wake-word */
  let userPrompt = msg.content;
  if (mentioned)
    userPrompt = userPrompt.replace(new RegExp(`<@!?${botUser.id}>`, 'g'), '').trim();
  if (wakeWord && !isDM) {
    const pat = Array.isArray(config.wakeWords)
      ? config.wakeWords.map(w => `(^|\\s)${w}(\\s|$)`).join('|')
      : `(^|\\s)${config.wakeWords}(\\s|$)`;
    userPrompt = userPrompt.replace(new RegExp(pat, 'gi'), ' ').trim();
  }
  if (!userPrompt && msg.attachments.size) userPrompt = '[Attachment content]';
  if (!userPrompt) {
    if (isDM || mentioned) await msg.reply('How can I help?').catch(() => {});
    return;
  }

  try {
    await withTyping(msg.channel as TextBasedChannel, async () => {
      config.redis?.enabled
        ? await pushMessage(msg.channelId, msg.author.username, userPrompt)
        : pushToMemory(msg.channelId, msg.author.username, userPrompt);

      const context   = await getContext(msg.channelId);
      const rawReply  = await generateText(context);
      const cleanFull = extractResponseContent(rawReply, botUser.username);
      const { textBefore, calls, textAfter } = splitByToolCalls(cleanFull);

      const before = config.hideThoughtProcess ? stripThought(textBefore) : textBefore;
      let after    = config.hideThoughtProcess ? stripThought(textAfter)  : textAfter; // 🔑 let (was const)

      /* ---------- automatic TTS branch ---------- */
      const mode = getTTSMode(msg.guildId ?? 'global');
      let skipNarration = false;
      if (mode !== 'off') {
        try {
          const wav = await synthesize(`${before} ${after}`.trim() || '[silence]');
          const mp3 = await convertWavToMp3(wav);
          const attachment = new AttachmentBuilder(mp3);
          if (mode === 'audio-only') {
            await msg.reply({ files: [attachment] });
            await fs.promises.unlink(wav).catch(() => {});
            await fs.promises.unlink(mp3).catch(() => {});
            return;                               // early exit
          }
          await msg.reply({ content: before + after, files: [attachment] });
          await fs.promises.unlink(wav).catch(() => {});
          await fs.promises.unlink(mp3).catch(() => {});
          skipNarration = true;                  // prevent duplicate
        } catch (e) { logger.error(`Auto-TTS failed: ${e}`); }
      }

      /* ---------- web-summary duplicate guard ---------- */
      if (config.summarizeSearch) {
        after = '';                              // router already sent summary
        skipNarration = true;
      }

      /* ---------- narration / tool-calls ---------- */
      if (!skipNarration && before) {
        const chunks = splitMessage(before, 1_800);
        await msg.reply(chunks[0]);
        for (const extra of chunks.slice(1)) await msg.channel.send(extra);
        saveBotMsg(msg.channelId, botUser.username, before);
      }

      if (calls.length === 0) {
        if (!skipNarration && after) saveBotMsg(msg.channelId, botUser.username, after);
        return;
      }

      for (const raw of calls) {
        const pretty = formatToolCallLine(raw);
        await msg.channel.send(pretty);
        saveBotMsg(msg.channelId, botUser.username, pretty);
      }
      for (const line of calls) {
        await tryHandleToolCall(line, msg.channel);
        if (!process.env.SUMMARIZE)
          await msg.channel.send('🤖 *Tool execution complete!*');
      }

      if (!skipNarration && after) {
        const chunks = splitMessage(after, 1_800);
        await msg.channel.send(chunks[0]);
        for (const extra of chunks.slice(1)) await msg.channel.send(extra);
        saveBotMsg(msg.channelId, botUser.username, after);
      }
      if (!before && !after && calls.length)
        saveBotMsg(msg.channelId, botUser.username, '[executed tool call]');
    });
  } catch (err: any) {
    logger.error(`Message handler error: ${err.message ?? err}`);
    await msg.reply('Sorry, I hit a snag while responding.').catch(() => {});
  }
});

/* ---------------- command refresh & login ------------------------- */
(async () => {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    logger.error('Missing DISCORD_TOKEN or CLIENT_ID vars'); process.exit(1);
  }
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    logger.info('🔃 Refreshing application commands…');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map(c => c.toJSON()) });
  } catch (err) { logger.error('Command refresh failed:', err); }
  try { await client.login(process.env.DISCORD_TOKEN); }
  catch (err) { logger.error('Discord login failed:', err); process.exit(1); }
})();

/* ---------------- helpers ----------------------------------------- */
function escapeRegex(str: string) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function extractResponseContent(full: string, bot: string) {
  const START = '<final_response>', END = '</final_response>';
  const raw = full.includes(START) && full.includes(END) && full.indexOf(START) < full.indexOf(END)
    ? full.slice(full.indexOf(START) + START.length, full.indexOf(END))
    : full;
  return raw.replace(new RegExp(`^${escapeRegex(bot)}:\\s*`, 'i'), '').trim();
}
function saveBotMsg(cId: string, bot: string, text: string) {
  if (!text) return;
  config.redis?.enabled ? pushMessage(cId, bot, text) : pushToMemory(cId, bot, text);
}

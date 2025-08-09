/* ────────────────────────────── index.ts ──────────────────────────────
 * Discord bot main entry-point (full featured)
 * ------------------------------------------------------------------- */
import 'dotenv/config';
import {
  Client, GatewayIntentBits, Partials, Collection, REST, Routes,
  ChatInputCommandInteraction, TextBasedChannel, AttachmentBuilder,
} from 'discord.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));

import { logger } from './utils/logger.js';
import { config } from './config.js';

/* Context / memory */
import { pushMessage as pushToMemory } from '../services/context.js';
import {
  pushMessage, getContext, convoKey,
  maybeSummarize, getRecentMessages, getSummary
} from '../services/cache.js';

/* Utilities */
import { formatToolCallLine } from './utils/formatToolCall.js';
import { withTyping, splitMessage } from './utils/messageUtils.js';
import { tryHandleToolCall } from './utils/toolCallRouter.js';
import { stripThought } from './utils/stripThought.js';
import { splitByToolCalls } from './utils/splitByToolCalls.js';
import { convertWavToMp3 } from './utils/audio.js';

/* Slash-command modules */
import { data as imgData,    execute as imgExec }    from '../commands/img.js';
import { data as sayData,    execute as sayExec }    from '../commands/say.js';
import { data as webData,    execute as webExec }    from '../commands/web.js';
import { data as musicData,  execute as musicExec }  from '../commands/music.js';
import { data as threadData, execute as threadExec } from '../commands/thread.js';
import { data as threadPrivData, execute as threadPrivExec } from '../commands/threadPrivate.js';
import { data as clearData,  execute as clearExec }  from '../commands/clear.js';
import { data as lorasData,  execute as lorasExec }  from '../commands/loras.js';
import { data as speakData,  execute as speakExec }  from '../commands/speak.js';
import { data as ttsSvcData, execute as ttsSvcExec } from '../commands/ttsService.js';

/* Services */
import { logInteraction } from '../services/db.js';
import { generateText }    from '../services/llm.js';
import { synthesize }      from '../services/tts.js';
import { getTTSMode }      from '../services/ttsMode.js';

/* ---------------- system prompt (env-resolved) --------------------- */
const DEFAULT_SYSTEM_PATH = path.resolve(process.cwd(), 'system_prompt.md');
const SYSTEM_PROMPT = resolveSystemPrompt();

/* ---------------- outputs config (optional archiving) -------------- */
const OUTPUT_SAVE = process.env.OUTPUT_SAVE === 'true';
const OUTPUT_DIR  = path.resolve(process.env.OUTPUT_DIR ?? './outputs');
if (OUTPUT_SAVE) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  logger.info(`[outputs] Archiving enabled -> ${OUTPUT_DIR}`);
}

/* ---------------- slash-command registry --------------------------- */
const commands = [
  imgData, sayData, webData, musicData, threadData, threadPrivData,
  clearData, lorasData, speakData, ttsSvcData,
];

type CmdHandler = (i: ChatInputCommandInteraction) => Promise<any>;
const handlers = new Collection<string, CmdHandler>([
  ['img',            imgExec],
  ['say',            sayExec],
  ['web',            webExec],
  ['music',          musicExec],
  ['thread',         threadExec],
  ['thread-private', threadPrivExec],
  ['clear',          clearExec],
  ['loras',          lorasExec],
  ['speak',          speakExec],
  ['tts-service',    ttsSvcExec],
] as Iterable<[string, CmdHandler]>);

/* ---------------- Discord client bootstrap ------------------------ */
declare module 'discord.js' {
  interface Client { commands: Collection<string, CmdHandler>; }
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

client.commands = handlers;

client.once('ready', () => {
  client.user
    ? logger.info(`✅ Logged in as ${client.user.tag}`)
    : logger.error(' Client user is null on ready event.');
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

/* ---------------- bot-authored capture (media + text) -------------- */
/** Capture everything the bot posts (text + attachments) into memory,
    and optionally download attachments to OUTPUT_DIR. */
client.on('messageCreate', async (msg) => {
  if (!msg.author.bot) return; // only bot-authored here

  const key = convoKey(msg.guildId ?? null, msg.channelId);
  const parts: string[] = [];
  if (msg.content) parts.push(msg.content);

  // archive + record attachments (Discord CDN URL available after send)
  for (const [, att] of msg.attachments) {
    const name = att.name ?? 'file';
    parts.push(`[file] ${name} ${att.url}`);
    if (OUTPUT_SAVE) {
      try {
        const fp = await downloadToOutputs(att.url, name, msg.guildId ?? 'dm', msg.channelId);
        logger.info(`[outputs] saved ${fp}`);
      } catch (e) {
        logger.warn(`[outputs] failed to save ${name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (parts.length) {
    try {
      if (config.redis?.enabled) {
        await pushMessage(key, 'assistant', parts.join('\n'), {
          id: msg.id, author_id: msg.author.id, author: msg.author.username, created_at: msg.createdTimestamp
        });
      } else {
        // legacy fallback (in-memory)
        await pushToMemory(msg.channelId, msg.author.username, parts.join('\n'));
      }
    } catch {/* ignore */}
  }

  // Summary buffer (if enabled)
  if (process.env.SUMMARY_ENABLED === 'true') {
    await maybeSummarize(key, async ({ previous, recent }) => {
      const prompt = buildSummaryPrompt(previous, recent.map(m => ({
        role: m.role, content: m.content, author: m.author
      })));
      return await generateText(prompt);
    }).catch(() => {});
  }
});

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
    if (config.postgres?.enabled) {
      await logInteraction(
        interaction.guildId ?? 'dm',
        interaction.user.id,
        interaction.commandName,
        Date.now() - start,
      );
    }
  } catch (e: any) {
    logger.error(`Error in /${interaction.commandName}: ${e.message ?? e}`);
    const payload = { content: '❌ Error executing command.' };
    interaction.replied || interaction.deferred
      ? await interaction.editReply(payload).catch(() => {})
      : await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
  }
});

/* ---------------- user message router ------------------------------ */
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return; // handled above in bot-authored capture

  // conversation key: guild/channel (threads use their own channel id)
  const key = convoKey(msg.guildId ?? null, msg.channelId);

  // (A) Always capture user messages (for multi-speaker context)
  try {
    if (config.redis?.enabled) {
      await pushMessage(key, 'user', msg.content, {
        id: msg.id, author_id: msg.author.id, author: msg.author.username, created_at: msg.createdTimestamp
      });
    } else {
      await pushToMemory(msg.channelId, msg.author.username, msg.content);
    }
  } catch (e) {
    logger.warn(`pushMessage (user) failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 1) Agentic tool-call fast path
  if (await tryHandleToolCall(msg.content, msg.channel)) return;

  // 2) Addressing rules (DMs, mention, or wake-word)
  if (!client.user) return;
  const botUser   = client.user;
  const isDM      = !msg.guild;
  const mentioned = msg.mentions.has(botUser.id);
  const wakeWord  = Array.isArray(config.wakeWords)
    ? config.wakeWords.some(w => msg.content.toLowerCase().includes(w.toLowerCase()))
    : msg.content.toLowerCase().includes(String(config.wakeWords).toLowerCase());

  if (!isDM && !mentioned && !wakeWord) return;

  // 3) Normalize prompt
  let userPrompt = msg.content;
  if (mentioned) userPrompt = userPrompt.replace(new RegExp(`<@!?${botUser.id}>`, 'g'), '').trim();
  if (wakeWord && !isDM) {
    const pat = Array.isArray(config.wakeWords)
      ? config.wakeWords.map(w => `(^|\\s)${escapeRegex(w)}(\\s|$)`).join('|')
      : `(^|\\s)${escapeRegex(String(config.wakeWords))}(\\s|$)`;
    userPrompt = userPrompt.replace(new RegExp(pat, 'gi'), ' ').trim();
  }
  if (!userPrompt && msg.attachments.size) userPrompt = '[Attachment content]';
  if (!userPrompt) {
    if (isDM || mentioned) await msg.reply('How can I help?').catch(() => {});
    return;
  }

  try {
    await withTyping(msg.channel as TextBasedChannel, async () => {
      // 4) Build token-budgeted context with system prompt
      const ctx = await getContext(key, SYSTEM_PROMPT);
      const prompt = buildPromptFromContext(ctx);   // generateText expects a string

      const rawReply = (await generateText(prompt))?.toString() ?? '';

      // 5) Extract just the model’s “assistant says …” text
      const cleanFull = extractResponseContent(rawReply, botUser.username);
      const { textBefore, calls, textAfter } = splitByToolCalls(cleanFull);

      const before = config.hideThoughtProcess ? stripThought(textBefore) : textBefore;
      let   after  = config.hideThoughtProcess ? stripThought(textAfter)  : textAfter;

      /* ---------- automatic TTS branch ---------- */
      const mode = getTTSMode(msg.guildId ?? 'global');
      let skipNarration = false;

      if (mode !== 'off') {
        try {
          const wav  = await synthesize(`${before} ${after}`.trim() || '[silence]');
          const mp3  = await convertWavToMp3(wav);
          const file = new AttachmentBuilder(mp3);

          if (mode === 'audio-only') {
            await msg.reply({ files: [file] });       // bot-authored capture records it
            await fsp.unlink(wav).catch(() => {});
            await fsp.unlink(mp3).catch(() => {});
            return; // audio only
          }

          // Speak AND send text in a single message
          await msg.reply({ content: (before + after).trim(), files: [file] });

          await fsp.unlink(wav).catch(() => {});
          await fsp.unlink(mp3).catch(() => {});
          skipNarration = true; // prevent double-sending text
        } catch (e) {
          logger.error(`Auto-TTS failed: ${e}`);
        }
      }

      /* ---------- web-summary duplicate guard (FIX) ---------- */
      // Only trim trailing narrative when the model actually used /web.
      const usedWebTool = calls.some((line) => /^`?\s*tool\s*call\s*:\s*\/web\b/i.test(line));
      if (config.summarizeSearch && usedWebTool) {
        after = '';              // router already posted the results/summary
      }

      /* ---------- narration / tool-calls ---------- */
      let postedSomething = false;

      // text before tool calls
      if (!skipNarration && before) {
        const chunks = splitMessage(before, 1_990); // Discord ~2000 chars limit. :contentReference[oaicite:1]{index=1}
        await msg.reply(chunks[0]);
        for (const extra of chunks.slice(1)) await msg.channel.send(extra);
        postedSomething = true;
      }

      if (calls.length === 0) {
        if (!skipNarration && after) {
          const chunks = splitMessage(after, 1_990);
          await msg.channel.send(chunks[0]);
          for (const extra of chunks.slice(1)) await msg.channel.send(extra);
          postedSomething = true;
        }

        // ✅ Fallback: if parser produced nothing, send raw model text
        if (!postedSomething && cleanFull.trim()) {
          const chunks = splitMessage(cleanFull.trim(), 1_990);
          await msg.reply(chunks[0]);
          for (const extra of chunks.slice(1)) await msg.channel.send(extra);
          postedSomething = true;
        }

        if (!postedSomething) {
          await msg.reply('…').catch(() => {}); // minimal fallback
        }
      } else {
        // pretty tool-call lines
        for (const raw of calls) {
          const pretty = formatToolCallLine(raw);
          await msg.channel.send(pretty);
        }

        // execute tool-calls in order
        for (const line of calls) {
          await tryHandleToolCall(line, msg.channel);
          if (!process.env.SUMMARIZE) await msg.channel.send('*Tool execution complete!*');
          // bot-authored capture records outputs (including media)
        }

        // text after tool calls
        if (!skipNarration && after) {
          const chunks = splitMessage(after, 1_990);
          await msg.channel.send(chunks[0]);
          for (const extra of chunks.slice(1)) await msg.channel.send(extra);
        }
      }

      // Summary buffer (if enabled)
      if (process.env.SUMMARY_ENABLED === 'true') {
        await maybeSummarize(key, async ({ previous, recent }) => {
          const prompt2 = buildSummaryPrompt(previous, recent.map(m => ({
            role: m.role, content: m.content, author: m.author
          })));
          return await generateText(prompt2);
        }).catch(() => {});
      }
    });
  } catch (err: any) {
    logger.error(`Message handler error: ${err.message ?? err}`);
    await msg.reply('Sorry, I hit a snag while responding.').catch(() => {});
  }
});

/* ---------------- command refresh & login ------------------------- */
(async () => {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    logger.error('Missing DISCORD_TOKEN or CLIENT_ID vars');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    logger.info(' Refreshing application commands…');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands.map(c => c.toJSON()),
    });
  } catch (err) {
    logger.error('Command refresh failed:', err);
  }

  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    logger.error('Discord login failed:', err);
    process.exit(1);
  }
})();

/* ---------------- helpers ----------------------------------------- */
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractResponseContent(full: string, bot: string) {
  // If an SDK wraps in "Assistant: ...", strip it
  const START = '', END = '';
  const raw = full.includes(START) && full.includes(END) && full.indexOf(START) < full.indexOf(END)
    ? full.slice(full.indexOf(START) + START.length, full.indexOf(END))
    : full;
  return raw.replace(new RegExp(`^${escapeRegex(bot)}:\\s*`, 'i'), '').trim();
}

function resolveSystemPrompt(): string {
  // Priority:
  // 1) SYSTEM_MESSAGE (literal or file:./path)
  const sys = process.env.SYSTEM_MESSAGE?.trim();
  if (sys) {
    const m = sys.match(/^file:(.+)$/i);
    if (m) {
      const p = path.resolve(process.cwd(), m[1].trim());
      try { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; } catch { return ''; }
    }
    return sys;
  }
  // 2) SYSTEM_PROMPT_PATH (fallbacks to ./system_prompt.md)
  const p = (process.env.SYSTEM_PROMPT_PATH ?? DEFAULT_SYSTEM_PATH);
  try { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; } catch { return ''; }
}

function buildPromptFromContext(ctx: Array<{ role: 'system'|'user'|'assistant', content: string }>): string {
  // Simple chat-to-single-string conversion for providers that want a raw prompt
  let out = '';
  for (const m of ctx) {
    const tag = m.role.toUpperCase();
    out += `${tag}: ${m.content}\n`;
  }
  out += 'ASSISTANT:';
  return out;
}

function buildSummaryPrompt(previous: string, recent: Array<{
  role: 'system'|'user'|'assistant', content: string, author?: string
}>): string {
  const pre = previous?.trim() ? previous.trim() : '(none)';
  const lines = recent.map(m => {
    const who = m.author ? `${m.role}:${m.author}` : m.role;
    return `- ${who}: ${m.content}`;
  }).join('\n');

  return [
    'You are a conversation summarizer.',
    'Update the existing summary using the recent messages.',
    'Keep it concise (<300 words), preserve facts, preferences, tasks, and open questions.',
    'Return ONLY the updated summary, no preface.',
    '',
    `Existing summary:\n${pre}`,
    '',
    `Recent messages:\n${lines}`,
    '',
    'Updated summary:'
  ].join('\n');
}

/* Save every attachment the bot posts (download Discord CDN → OUTPUT_DIR) */
async function downloadToOutputs(url: string, name: string, guildId: string, channelId: string): Promise<string> {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const base = (name || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 80);
  const ext  = path.extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  const out  = path.join(OUTPUT_DIR, `${ts}_${guildId}_${channelId}_${stem}${ext || ''}`);

  const res  = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf  = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(out, buf);
  return out;
}

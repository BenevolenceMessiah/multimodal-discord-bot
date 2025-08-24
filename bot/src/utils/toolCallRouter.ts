// bot/src/utils/toolCallRouter.ts
/****************************************************************************************
 * toolCallRouter.ts – routes “/img”, “/web”, and “/music” tool-calls issued by the LLM.
 * Streams results back to Discord with 2 000-char chunking for long messages.
 ****************************************************************************************/

import type { TextBasedChannel } from 'discord.js';
import { AttachmentBuilder } from 'discord.js';

import { logger }       from './logger.js';
import { config }       from '../config.js';
import { stripThought } from './stripThought.js';
import { TOOL_LINE_RE } from './regexes.js';

import { generateImage } from '../../services/image.js';
import { generateMusic } from '../../services/ace.js';
import { chunkAudio }    from './audio.js';
import { generateText }  from '../../services/llm.js';

const KNOWN_TOOLS = new Set<string>(['/web', '/img', '/music']);

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */
type Sendable = TextBasedChannel & { send: (...args: any[]) => any };
function isSendable(ch: TextBasedChannel | null | undefined): ch is Sendable {
  return !!ch && typeof (ch as any).send === 'function';
}
function chunkText(text: string, size = 1990): string[] {
  const s = (text ?? '').toString();
  if (!s.trim()) return [];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}
async function sendChunked(channel: TextBasedChannel, text: string): Promise<number> {
  if (!isSendable(channel)) return 0;
  const chunks = chunkText(text, 1990);
  if (!chunks.length) return 0;
  await channel.send(chunks[0]);
  for (const extra of chunks.slice(1)) await channel.send(extra);
  return chunks.length;
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */
export async function tryHandleToolCall(raw: string, channel: TextBasedChannel): Promise<boolean> {
  if (!config.agenticToolcall) {
    logger.debug?.('[router] agenticToolcall=false → bypass');
    return false;
  }

  const canon = canonicalizeToolLine(raw);
  if (!canon) {
    logger.debug?.(`[router] canonicalize failed → "${truncate(raw)}"`);
    return false;
  }

  const m = canon.match(TOOL_LINE_RE);
  if (!m) {
    logger.debug?.(`[router] not a tool-call line → "${truncate(canon)}"`);
    return false;
  }

  const cmd  = (m.groups?.cmd || '').toLowerCase();
  const rest = (m.groups?.rest || '').trim();

  if (!KNOWN_TOOLS.has(cmd)) {
    logger.warn(`[router] unknown tool "${cmd}" in line "${truncate(canon)}"`);
    return false;
  }

  let posted = 0;
  try {
    switch (cmd) {
      case '/img':   posted += await handleImg(rest, channel);   break;
      case '/web':   posted += await handleWeb(rest, channel);   break;
      case '/music': posted += await handleMusic(rest, channel); break;
      default:       logger.warn(`[router] no handler for "${cmd}"`); return false;
    }
  } catch (e: any) {
    logger.error(`[router] error executing ${cmd}: ${e?.message ?? e}`);
    return false;
  }

  const handled = posted > 0;
  logger.info(`[router] ${cmd} handled=${handled} (posted=${posted})`);
  return handled;
}

/* ------------------------------------------------------------------ */
/* handlers                                                           */
/* ------------------------------------------------------------------ */
async function handleImg(arg: string, channel: TextBasedChannel): Promise<number> {
  const prompt = unwrap(arg);
  if (!prompt) return 0;
  const img = await generateImage(prompt);
  if (!isSendable(channel)) return 0;
  await channel.send({ content: `🖼️ **Generated:** ${prompt}`, files: [img] });
  return 1;
}

interface TavilyHit { title: string; url: string; content: string }

async function handleWeb(arg: string, channel: TextBasedChannel): Promise<number> {
  const query = unwrap(arg);
  if (!query) return 0;

  const key = process.env.TAVILY_KEY;
  if (!key) {
    if (!isSendable(channel)) return 0;
    await channel.send('⚠️ Tavily key missing – set `TAVILY_KEY`.');
    return 1;
  }

  const body = { query, max_results: 8, include_answer: true };
  let res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const url =
      `https://api.tavily.com/search?api_key=${key}` +
      `&query=${encodeURIComponent(query)}&max_results=8&include_answer=true`;
    res = await fetch(url);
  }
  if (!res.ok) throw new Error(`Tavily error: ${res.status}`);

  const { answer = '', results = [] } = (await res.json()) as { answer?: string; results: TavilyHit[] };

  if (config.summarizeSearch) {
    const snippets = results.map((h, i) => `[${i + 1}] ${h.title}: ${h.content.slice(0, 140)}…`).join('\n');
    const prompt = [
      'You are a concise research assistant.',
      `User asked: "${query}"`,
      answer ? `Tavily short answer: ${answer}` : '',
      'Snippets:\n' + snippets,
      '\nWrite a ≤600-word answer that cites no URLs.',
    ].join('\n');

    const raw  = await generateText(prompt);
    const tidy = config.hideThoughtProcess ? stripThought(raw) : raw;
    return await sendChunked(channel, `🔎 **Summary:**\n${tidy.trim()}`);
  }

  const lines: string[] = answer ? [`**Answer** → ${answer}`] : [];
  for (const { title, url, content } of results) {
    lines.push(`• **${title}** – ${content.slice(0, 140).trim()}…\n${url}`);
  }
  return await sendChunked(channel, lines.join('\n\n'));
}

async function handleMusic(arg: string, channel: TextBasedChannel): Promise<number> {
  const text = unwrap(arg);
  if (!text) return 0;

  // First paragraph = prompt/tags; rest = lyrics (optional)
  const [prompt, ...rest] = text.split(/\n\s*\n/);
  const audio = await generateMusic({
    prompt: (prompt || '').trim(),
    lyrics: rest.join('\n').trim(),
    format: (process.env.ACE_STEP_FORMAT ?? 'mp3') as 'mp3' | 'wav' | 'flac',
  });

  const parts = await chunkAudio(audio);
  if (!parts.length) return 0;

  const totalBatches = Math.ceil(parts.length / 10);
  let posted = 0;
  for (let i = 0; i < parts.length; i += 10) {
    if (!isSendable(channel)) break;
    const slice = parts.slice(i, i + 10);
    await channel.send({
      content: `🎶 Track segment ${Math.floor(i / 10) + 1}/${totalBatches}`,
      files: slice.map((p, idx) => new AttachmentBuilder(p, { name: `seg_${i + idx}.${(process.env.ACE_STEP_FORMAT ?? 'mp3')}` })),
    });
    posted += 1;
  }
  return posted;
}

/* ------------------------------------------------------------------ */
/* utilities                                                          */
/* ------------------------------------------------------------------ */
function canonicalizeToolLine(raw: string): string {
  const s = String(raw ?? '');
  const ix = s.search(/`?\s*tool\s*call\s*:/i);
  return ix === -1 ? '' : s.slice(ix).trim();
}

function unwrap(tail: string): string {
  const s = (tail ?? '').trim();
  if (!s) return '';

  // Triple-backtick fenced block (optionally with language hint)
  if (s.startsWith('```')) {
    const firstNL = s.indexOf('\n', 3);
    const endFence = s.lastIndexOf('```');

    let inside = '';
    if (firstNL !== -1 && endFence !== -1 && endFence > firstNL) {
      inside = s.slice(firstNL + 1, endFence);
    } else {
      inside = s.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
    }

    // Keep any trailing text after the last fence — critical when the opening quote
    // starts inside the fence and the closing quote comes after it.
    const tailAfterFence = endFence !== -1 ? s.slice(endFence + 3).trim() : '';

    const merged = (inside + (tailAfterFence ? `\n${tailAfterFence}` : '')).trim();

    if (isEdgeQuoted(merged, '"') || isEdgeQuoted(merged, "'")) {
      return stripEdgeQuotes(merged);
    }
    return merged;
  }

  // Symmetric wrappers
  const pairs: Record<string, string> = { '"': '"', "'": "'", '`': '`', '(': ')', '[': ']', '{': '}' };
  const first = s[0];
  const close = pairs[first as keyof typeof pairs];
  if (close && s.endsWith(close)) return s.slice(1, -1).trim();

  return s;
}

function isEdgeQuoted(text: string, q: '"' | "'"): boolean {
  if (!text || text[0] !== q) return false;
  if (text[text.length - 1] !== q) return false;
  // disallow escaped final quote
  if (text.length > 1 && text[text.length - 2] === '\\') return false;
  return true;
}
function stripEdgeQuotes(text: string): string {
  return text.slice(1, -1).trim();
}
function truncate(input: string, n = 140): string {
  const t = (input ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

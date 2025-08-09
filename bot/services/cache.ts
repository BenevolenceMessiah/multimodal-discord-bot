import { createClient, type RedisClientType } from 'redis';
import { Pool } from 'pg';
import os from 'node:os';

export type Role = 'user' | 'assistant' | 'system';

export interface ChatMsg {
  id: string;                // snowflake or generated id
  role: Role;
  author_id?: string;
  author?: string;
  content: string;
  created_at: number;        // ms epoch
}

interface Cfg {
  enabled: boolean;
  redisUrl?: string;
  maxMessages: number;       // hard cap per conversation list
  tokensBudget: number;      // approximate prompt budget
  avgCharsPerToken: number;  // heuristics; ~4 chars/token EN
  summaryEvery: number;
}

const cfg: Cfg = {
  enabled: (process.env.REDIS_ENABLED === 'true') || !!process.env.REDIS_URL || !!process.env.REDIS_HOST,
  redisUrl: process.env.REDIS_URL ??
            (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT ?? 6379}` : undefined),
  maxMessages: Number(process.env.MEMORY_MAX_MESSAGES ?? 200),
  tokensBudget: Number(process.env.MEMORY_TOKENS_BUDGET ?? 4096),
  avgCharsPerToken: Number(process.env.MEMORY_AVG_CHARS_PER_TOKEN ?? 4),
  summaryEvery: Number(process.env.SUMMARY_EVERY ?? 100),
};

let redis: RedisClientType | null = null;

/* ---------- Optional Postgres mirror (bot transcripts) ------------- */
const pgEnabled = !!process.env.DATABASE_URL;
let pg: Pool | null = null;
if (pgEnabled) {
  pg = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
}

/* ---------- Redis bootstrap --------------------------------------- */
async function getRedis(): Promise<RedisClientType | null> {
  if (!cfg.enabled || !cfg.redisUrl) return null;
  if (redis) return redis;
  redis = createClient({ url: cfg.redisUrl });
  redis.on('error', (e) => console.error('[redis] error', e));
  await redis.connect();
  return redis;
}

/* ---------- Keys --------------------------------------------------- */
export function convoKey(guildId: string | null, channelId: string, threadId?: string | null): string {
  const g = guildId ?? '0';
  return threadId ? `chat:${g}:${channelId}:${threadId}` : `chat:${g}:${channelId}`;
}
function listKey(key: string)     { return `list:${key}`; }
function summaryKey(key: string)  { return `summary:${key}`; }
function counterKey(key: string)  { return `count:${key}`; }

/* ---------- Push a message into rolling window -------------------- */
export async function pushMessage(
  key: string,
  role: Role,
  content: string,
  opts?: { id?: string; author_id?: string; author?: string; created_at?: number }
): Promise<void> {
  const r = await getRedis();
  const msg: ChatMsg = {
    id: opts?.id ?? cryptoRandomId(),
    role,
    author_id: opts?.author_id,
    author: opts?.author,
    content,
    created_at: opts?.created_at ?? Date.now(),
  };

  if (r) {
    const lk = listKey(key);
    await r.lPush(lk, JSON.stringify(msg));
    await r.lTrim(lk, 0, cfg.maxMessages - 1);
    await r.incr(counterKey(key));
  }

  if (pg && pgEnabled) {
    try {
      await pg.query(
        `INSERT INTO bot_messages (key, role, author_id, author, content, created_at)
         VALUES ($1,$2,$3,$4,$5,TO_TIMESTAMP($6/1000.0))`,
        [key, role, msg.author_id ?? null, msg.author ?? null, msg.content, msg.created_at]
      );
    } catch { /* table might not exist; ignore */ }
  }
}

/* ---------- Fetch summary & recent -------------------------------- */
export async function getSummary(key: string): Promise<string> {
  const r = await getRedis();
  if (!r) return '';
  return (await r.get(summaryKey(key))) ?? '';
}

export async function getRecentMessages(key: string, limit = cfg.maxMessages): Promise<ChatMsg[]> {
  const r = await getRedis();
  if (!r) return [];
  const raw = await r.lRange(listKey(key), 0, Math.max(0, limit - 1));
  const msgs = raw.map(j => safeParse<ChatMsg>(j)).filter(Boolean) as ChatMsg[];
  msgs.reverse(); // oldest -> newest
  return msgs;
}

/* ---------- Build context by token budget ------------------------- */
export async function getContext(
  key: string,
  extraSystem?: string
): Promise<Array<{ role: Role, content: string, author?: string }>> {
  const r = await getRedis();
  let raw: string[] = [];
  if (r) raw = await r.lRange(listKey(key), 0, cfg.maxMessages - 1);

  const msgs: ChatMsg[] = raw.map(j => safeParse<ChatMsg>(j)).filter(Boolean) as ChatMsg[];
  msgs.reverse();

  const sys = extraSystem?.trim()
    ? [{ role: 'system' as const, content: extraSystem.trim() }]
    : [];

  const budget = cfg.tokensBudget;
  const acc: Array<{ role: Role, content: string, author?: string }> = [...sys];
  let used = estimateTokens(sys);

  for (const m of msgs) {
    const item = { role: m.role, content: formatForLLM(m), author: m.author };
    const cost = estimateTokens([item]);
    if (used + cost > budget) {
      const remainingTokens = Math.max(0, budget - used - 64);
      if (remainingTokens > 0) {
        const approxChars = remainingTokens * cfg.avgCharsPerToken;
        item.content = item.content.slice(-approxChars);
        acc.push(item);
        used += estimateTokens([item]);
      }
      break;
    }
    acc.push(item);
    used += cost;
  }

  return acc;
}

/* ---------- Summary buffer ---------------------------------------- */
export async function maybeSummarize(
  key: string,
  summarizer: (input: { previous: string, recent: ChatMsg[] }) => Promise<string>
): Promise<void> {
  if (process.env.SUMMARY_ENABLED !== 'true') return;
  if (cfg.summaryEvery <= 0) return;

  const r = await getRedis();
  if (!r) return;

  // summarize roughly every N pushes
  const count = Number(await r.get(counterKey(key)) ?? 0);
  if (count === 0 || (count % cfg.summaryEvery) !== 0) return;

  const prev = (await r.get(summaryKey(key))) ?? '';
  const recent = await getRecentMessages(key, cfg.maxMessages);
  if (recent.length === 0) return;

  const updated = (await summarizer({ previous: prev, recent })).trim();
  if (!updated) return;

  await r.set(summaryKey(key), updated);
}

/* ---------- Helpers ----------------------------------------------- */
function estimateTokens(msgs: Array<{ role: Role, content: string }>): number {
  let chars = 0;
  for (const m of msgs) chars += (m.content?.length ?? 0) + 8;
  return Math.ceil(chars / cfg.avgCharsPerToken);
}

function formatForLLM(m: ChatMsg): string {
  const who = m.author ? `${m.role}:${m.author}` : m.role;
  return `${who}: ${m.content}`;
}

function safeParse<T>(j: string): T | null {
  try { return JSON.parse(j) as T; } catch { return null; }
}

function cryptoRandomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}-${os.hostname()}`;
}

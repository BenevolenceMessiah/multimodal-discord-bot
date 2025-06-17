/******************************************************************
 * bot/config.ts – typed, side-effect-free config loader
 * ---------------------------------------------------------------
 * • Hydrates config.yaml with ${ENV} placeholders
 * • Applies .env overrides (camelCase or SNAKE_CASE)
 * • Adds two booleans: hideThoughtProcess & agenticToolcall
 * • Logs meaningful errors via utils/logger.ts
 * • Freezes and exports an immutable, fully-typed object
 ******************************************************************/

import fs   from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';                   // YAML parser
import { BotConfig } from './types.js';
import { logger }   from './utils/logger.js'; // central winston/pino wrapper

const CONFIG_FILE = path.resolve(process.cwd(), 'config.yaml');

/* ───────────────────── helpers ────────────────────── */
const toBool = (v: unknown, fallback = false): boolean =>
  typeof v === 'string'
    ? ['true', '1', 'yes', 'on', 'y'].includes(v.toLowerCase())
    : typeof v === 'boolean'
    ? v
    : fallback;

const read = (p: string) =>
  fs.readFileSync(p, { encoding: 'utf8' }).replace(/\r\n/g, '\n');

const interpolate = (s: string) =>
  s.replace(/\$\{([^:}]+)(:-([^}]*))?}/g, (_, k: string, _2: unknown, d: string) =>
    process.env[k] ?? d ?? '',
  );

function invariant(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    logger.error(msg);                       // keep operator-visible trace
    throw new Error(`Config error » ${msg}`);
  }
}

/* ───────────── YAML → object ───────────── */
const rawYaml = interpolate(read(CONFIG_FILE));
const cfg = yaml.load(rawYaml) as BotConfig & {
  hideThoughtProcess?: boolean;
  agenticToolcall?:   boolean;
};

/* ───────────── .env overrides ───────────── */
for (const [envKey, val] of Object.entries(process.env)) {
  const k = envKey.toLowerCase();
  switch (k) {
    case 'hidethoughtprocess':
    case 'hide_thought_process':
      cfg.hideThoughtProcess = toBool(val);
      break;
    case 'agentictoolcall':
    case 'agentic_toolcall':
      cfg.agenticToolcall = !/^(false|0|no|off)$/i.test(String(val ?? '')); // default true
      break;
    default:
      if (k in cfg) (cfg as any)[k] = val; // flat override
  }
}

/* ───── systemMessage override (with logging) ───── */
if (process.env.SYSTEM_MESSAGE) {
  const sm = process.env.SYSTEM_MESSAGE!;
  if (sm.startsWith('file:')) {
    const filePath = sm.slice(5).trim();
    try {
      cfg.systemMessage = read(filePath);
    } catch (err) {
      logger.error(`❌ Failed to load system prompt: ${filePath}`, err);
      throw err;
    }
  } else {
    cfg.systemMessage = sm.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  }
}

/* ───── defaults for booleans ───── */
cfg.hideThoughtProcess ??= false;
cfg.agenticToolcall   ??= true;

/* ───── runtime validations (log + throw) ───── */
const { endpoints = {}, search, redis, postgres } = cfg;

invariant(!(cfg.textgenProvider === 'ollama'         && !endpoints.ollama),        'OLLAMA_URL must be set when using Ollama');
invariant(!(cfg.textgenProvider === 'openrouter'     && !endpoints.openrouter),    'OPENROUTER_URL must be set when using OpenRouter');
invariant(!(cfg.imagegenProvider === 'stablediffusion' && !endpoints.stablediffusion), 'SD_URL must be set when using Stable Diffusion');
invariant(!(cfg.voicegenProvider === 'alltalk'       && !endpoints.alltalk),       'ALLTALK_URL must be set when using AllTalk');
invariant(!(cfg.voicegenProvider === 'elevenlabs'    && !cfg.elevenlabsKey),       'ELEVENLABS_KEY must be set when using ElevenLabs');
if (search?.provider === 'tavily') invariant(!!search.tavilyKey, 'TAVILY_KEY must be set when using Tavily');

if (redis?.enabled) {
  invariant(!!redis.url, 'REDIS_URL must be set when Redis is enabled');
  invariant(Number.isInteger(redis.ttl) && redis.ttl >= -1, 'REDIS_TTL must be an integer ≥ -1');
}

if (postgres?.enabled) {
  invariant(!!postgres.url, 'POSTGRES_URL must be set when PostgreSQL is enabled');
  invariant(/^postgres(?:ql)?:\/\/.+\/.+$/.test(postgres.url), 'POSTGRES_URL must be a valid connection string');
}

/* ─────────── produce final, typed object ─────────── */
interface FinalConfig extends BotConfig {
  hideThoughtProcess: boolean;
  agenticToolcall:   boolean;
}

const finalCfg: FinalConfig = {
  ...cfg,
  hideThoughtProcess: cfg.hideThoughtProcess,
  agenticToolcall:    cfg.agenticToolcall,
};

/** Immutable, application-wide config */
export const config = Object.freeze(finalCfg) as Readonly<FinalConfig>; // Object.freeze ensures runtime immutability :contentReference[oaicite:5]{index=5}

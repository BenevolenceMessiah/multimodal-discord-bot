/******************************************************************
 * bot/config.ts – typed, side-effect-free config loader
 * ---------------------------------------------------------------
 * • Hydrates config.yaml with ${ENV} placeholders
 * • Applies .env overrides (camelCase or SNAKE_CASE)
 * • Adds booleans hideThoughtProcess, agenticToolcall, summarizeSearch
 * • Adds musicgenProvider, discordUploadLimitBytes
 * • Adds verbose flag for controlling LLM commentary around tool calls
 * • Logs meaningful errors via utils/logger.ts
 * • Freezes and exports an immutable, fully-typed object
 ******************************************************************/

import fs   from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { BotConfig } from './types.js';
import { logger }   from './utils/logger.js';

const CONFIG_FILE = path.resolve(process.cwd(), 'config.yaml');

/* ───────────── helper fns ───────────── */
const toBool = (v: unknown, fallback = false): boolean =>
  typeof v === 'string'
    ? ['true', '1', 'yes', 'on', 'y'].includes(v.toLowerCase())
    : typeof v === 'boolean'
    ? v
    : fallback;

const toInt = (v: unknown, dflt: number): number => {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : dflt;
};

const read = (p: string) =>
  fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const interpolate = (s: string) =>
  s.replace(/\$\{([^:}]+)(:-([^}]*))?}/g, (_: string, k: string, _2: unknown, d: string) =>
    process.env[k] ?? d ?? '',
  );

function invariant(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    logger.error(msg);
    throw new Error(`Config error » ${msg}`);
  }
}

/* ───────────── parse YAML ───────────── */
const rawYaml = interpolate(read(CONFIG_FILE));
const cfg = yaml.load(rawYaml) as BotConfig & {
  hideThoughtProcess?:        boolean;
  agenticToolcall?:           boolean;
  summarizeSearch?:           boolean;
  musicgenProvider?:          string;
  discordUploadLimitBytes?:   number;
  verbose?:                  boolean;
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
      cfg.agenticToolcall = !/^(false|0|no|off)$/i.test(String(val ?? ''));
      break;
    case 'summarize':
    case 'summarise':  
    case 'summarizesearch':
    case 'summarize_search':
      cfg.summarizeSearch = toBool(val);
      break;
    case 'musicgenprovider':
    case 'musicgen_provider':
      cfg.musicgenProvider = String(val).toLowerCase();
      break;
    case 'discorduploadlimitbytes':
    case 'discord_upload_limit_bytes':
      cfg.discordUploadLimitBytes = toInt(val, 9_500_000);
      break;
    case 'verbose':
    case 'verbose_output':
      cfg.verbose = toBool(val);
      break;
    default:
      if (k in cfg) (cfg as any)[k] = val;
  }
}

/* ───── systemMessage override ───── */
if (process.env.SYSTEM_MESSAGE) {
  const sm = process.env.SYSTEM_MESSAGE!;
  if (sm.startsWith('file:')) {
    const filePath = sm.slice(5).trim();
    try { cfg.systemMessage = read(filePath); }
    catch (err) {
      logger.error(`❌ Failed to load system prompt: ${filePath}`, err);
      throw err;
    }
  } else {
    cfg.systemMessage = sm.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  }
}

/* ───── defaults ───── */
cfg.hideThoughtProcess       ??= false;
cfg.agenticToolcall          ??= true;
cfg.summarizeSearch          ??= false;
cfg.musicgenProvider         ??= cfg.musicgenProvider ?? 'none';
cfg.discordUploadLimitBytes  ??= 9_500_000;
cfg.verbose                  ??= false;

/* ───── runtime validations ───── */
const { endpoints = {}, search, redis, postgres } = cfg;

invariant(!(cfg.textgenProvider  === 'ollama'          && !endpoints.ollama),     'OLLAMA_URL must be set when using Ollama');
invariant(!(cfg.textgenProvider  === 'openrouter'      && !endpoints.openrouter), 'OPENROUTER_URL must be set when using OpenRouter');
invariant(!(cfg.imagegenProvider === 'stablediffusion' && !endpoints.stablediffusion), 'SD_URL must be set when using Stable Diffusion');
invariant(!(cfg.voicegenProvider === 'alltalk'         && !endpoints.alltalk),    'ALLTALK_URL must be set when using AllTalk');
invariant(!(cfg.voicegenProvider === 'elevenlabs'      && !cfg.elevenlabsKey),    'ELEVENLABS_KEY must be set when using ElevenLabs');
if (search?.provider === 'tavily') invariant(!!search.tavilyKey, 'TAVILY_KEY must be set when using Tavily');
/* --- new ACE-Step guard --- */
invariant(!(cfg.musicgenProvider === 'acestep' && !endpoints.acestep && !process.env.ACE_STEP_BASE),
  'ACE_STEP_BASE (or endpoints.acestep) must be set when using AceStep');

if (redis?.enabled) {
  invariant(!!redis.url, 'REDIS_URL must be set when Redis is enabled');
  invariant(Number.isInteger(redis.ttl) && redis.ttl >= -1, 'REDIS_TTL must be an integer ≥ -1');
}
if (postgres?.enabled) {
  invariant(!!postgres.url, 'POSTGRES_URL must be set when PostgreSQL is enabled');
  invariant(/^postgres(?:ql)?:\/\/.+\/.+$/.test(postgres.url), 'POSTGRES_URL must be a valid connection string');
}
/* Upload-limit sanity */
invariant(Number.isInteger(cfg.discordUploadLimitBytes) && cfg.discordUploadLimitBytes > 0,
  'discordUploadLimitBytes must be a positive integer');

/* ─────────── final, typed object ─────────── */
interface FinalConfig extends BotConfig {
  hideThoughtProcess:        boolean;
  agenticToolcall:           boolean;
  summarizeSearch:           boolean;
  musicgenProvider:          string;
  discordUploadLimitBytes:   number;
  verbose:                   boolean;
}

export const config = Object.freeze({
  ...cfg,
  hideThoughtProcess:      cfg.hideThoughtProcess,
  agenticToolcall:         cfg.agenticToolcall,
  summarizeSearch:         cfg.summarizeSearch,
  musicgenProvider:        cfg.musicgenProvider,
  discordUploadLimitBytes: cfg.discordUploadLimitBytes,
  verbose:                 cfg.verbose,
}) as Readonly<FinalConfig>;

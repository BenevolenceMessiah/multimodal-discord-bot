import fs from 'fs';
import yaml from 'js-yaml';
import { BotConfig } from './types.js';
import { randomUUID } from 'crypto';

/** Replace ${ENV_KEY} or ${ENV_KEY:-default} placeholders inside YAML text */
function interpolate(str: string): string {
  return str.replace(/\$\{([^:}]+)(:-([^}]*))?}/g, (_, key, _2, def) =>
    process.env[key] ?? def ?? ''
  );
}

// Load and hydrate config.yaml with environment variables
const raw = fs.readFileSync('config.yaml', 'utf8');
const hydrated = interpolate(raw);
const cfg = yaml.load(hydrated) as BotConfig;

// Apply flat environment overrides
for (const [k, v] of Object.entries(process.env)) {
  const lc = k.toLowerCase();
  if (lc in cfg) (cfg as any)[lc] = v;
  if (lc.startsWith('n8n_')) {
    const key = lc.slice(4);
    if (key in cfg) (cfg as any)[key] = v;
  }
}

// Handle multiline SYSTEM_MESSAGE from .env
if (process.env.SYSTEM_MESSAGE) {
  cfg.systemMessage = process.env.SYSTEM_MESSAGE.replace(/\\n/g, '\n');
}

// Validate required configuration fields
if (cfg.textgenProvider === 'ollama' && !cfg.endpoints.ollama) {
  throw new Error("OLLAMA_URL must be defined in config.yaml or .env when using Ollama");
}

if (cfg.textgenProvider === 'openrouter' && !cfg.endpoints.openrouter) {
  throw new Error("OPENROUTER_URL must be defined in config.yaml or .env when using OpenRouter");
}

if (cfg.imagegenProvider === 'stablediffusion' && !cfg.endpoints.stablediffusion) {
  throw new Error("SD_URL must be defined in config.yaml or .env when using Stable Diffusion");
}

if (cfg.voicegenProvider === 'alltalk' && !cfg.endpoints.alltalk) {
  throw new Error("ALLTALK_URL must be defined in config.yaml or .env when using AllTalk");
}

if (cfg.voicegenProvider === 'elevenlabs' && !cfg.elevenlabsKey) {
  throw new Error("ELEVENLABS_KEY must be defined in config.yaml or .env when using ElevenLabs");
}

if (cfg.search?.provider === 'tavily' && !cfg.search?.tavilyKey) {
  throw new Error("TAVILY_KEY must be defined in config.yaml or .env when using Tavily");
}

// Ensure Redis URL is defined when Redis is enabled
if (cfg.redis?.enabled && !cfg.redis.url) {
  throw new Error("REDIS_URL must be defined in config.yaml or .env when Redis is enabled");
}

// Ensure PostgreSQL is properly configured
if (cfg.postgres?.enabled) {
  if (!cfg.postgres.url) {
    throw new Error("POSTGRES_URL must be defined in config.yaml or .env when PostgreSQL is enabled");
  }

  // More flexible PostgreSQL URL validation
  if (!/^postgres(ql)?:\/\/.+\/.*$/.test(cfg.postgres.url)) {
    throw new Error("POSTGRES_URL must be a valid PostgreSQL connection string");
  }
}

// Ensure Redis TTL is valid when Redis is enabled
if (cfg.redis?.enabled) {
  if (typeof cfg.redis.ttl !== 'number' || cfg.redis.ttl < -1) {
    throw new Error("REDIS_TTL must be >= -1 (-1 = no expiration)");
  }
  if (!Number.isInteger(cfg.redis.ttl)) {
    throw new Error("REDIS_TTL must be an integer value");
  }
}

// Final export
export const config: BotConfig = cfg;
/******************************************************************
 *  bot/config.ts  –  centralised configuration loader & validator
 *  - Hydrates config.yaml with ${ENV} placeholders
 *  - Applies flat .env overrides (camelCase or SNAKE_CASE)
 *  - Adds two Booleans:  hideThoughtProcess  &  agenticToolcall
 ******************************************************************/
import fs from "fs";
import yaml from "js-yaml";
import { BotConfig } from "./types.js";
import { logger } from "./utils/logger.js";

/* ─────────────────────── Types ─────────────────────── */
interface EnhancedBotConfig extends BotConfig {
  hideThoughtProcess: boolean;
  agenticToolcall: boolean;
}

/* ───────────────── Interpolation helper ────────────── */
function interpolate(str: string): string {
  // supports ${ENV} and ${ENV:-default}
  return str.replace(/\$\{([^:}]+)(:-([^}]*))?}/g, (_, key, _2, def) =>
    process.env[key] ?? def ?? "",
  );
}

/* ───────────────── Load + hydrate YAML ─────────────── */
const raw = fs.readFileSync("config.yaml", "utf8");
const hydrated = interpolate(raw);
const cfg = yaml.load(hydrated) as EnhancedBotConfig;

/* ─────────────── Flat .env overrides ───────────────── */
for (const [k, v] of Object.entries(process.env)) {
  const lc = k.toLowerCase();

  /* hideThoughtProcess flag */
  if (lc === "hidethoughtprocess" || lc === "hide_thought_process") {
    cfg.hideThoughtProcess = v?.toLowerCase() === "true";
    continue;
  }

  /* agenticToolcall flag  (AGENTIC_TOOLCALL / agentictoolcall) */
  if (lc === "agentictoolcall" || lc === "agentic_toolcall") {
    cfg.agenticToolcall = v?.toLowerCase() !== "false"; // default true
    continue;
  }

  /* generic top-level override */
  if (lc in cfg) (cfg as any)[lc] = v;
  else if (lc.startsWith("n8n_")) {
    const key = lc.slice(4);
    if (key in cfg) (cfg as any)[key] = v;
  }
}

/* ────────────── SYSTEM_MESSAGE override ────────────── */
if (process.env.SYSTEM_MESSAGE) {
  if (process.env.SYSTEM_MESSAGE.startsWith("file:")) {
    const filePath = process.env.SYSTEM_MESSAGE.slice(5).trim();
    try {
      cfg.systemMessage = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n").trim();
    } catch (err) {
      logger.error(`❌ Failed to load system prompt: ${filePath}`, err);
      throw new Error(`System prompt file not found: ${filePath}`);
    }
  } else {
    cfg.systemMessage = process.env.SYSTEM_MESSAGE.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  }
}

/* ─────────────── Default missing Booleans ──────────── */
if (cfg.hideThoughtProcess === undefined) cfg.hideThoughtProcess = false;
if (cfg.agenticToolcall === undefined)   cfg.agenticToolcall   = true;

/* ─────────────────── Validations ───────────────────── */
if (cfg.textgenProvider === "ollama" && !cfg.endpoints.ollama)
  throw new Error("OLLAMA_URL must be set when using Ollama");

if (cfg.textgenProvider === "openrouter" && !cfg.endpoints.openrouter)
  throw new Error("OPENROUTER_URL must be set when using OpenRouter");

if (cfg.imagegenProvider === "stablediffusion" && !cfg.endpoints.stablediffusion)
  throw new Error("SD_URL must be set when using Stable Diffusion");

if (cfg.voicegenProvider === "alltalk" && !cfg.endpoints.alltalk)
  throw new Error("ALLTALK_URL must be set when using AllTalk");

if (cfg.voicegenProvider === "elevenlabs" && !cfg.elevenlabsKey)
  throw new Error("ELEVENLABS_KEY must be set when using ElevenLabs");

if (cfg.search?.provider === "tavily" && !cfg.search?.tavilyKey)
  throw new Error("TAVILY_KEY must be set when using Tavily");

if (cfg.redis?.enabled) {
  if (!cfg.redis.url) throw new Error("REDIS_URL must be set when Redis is enabled");
  if (typeof cfg.redis.ttl !== "number" || cfg.redis.ttl < -1 || !Number.isInteger(cfg.redis.ttl))
    throw new Error("REDIS_TTL must be an integer ≥ -1");
}

if (cfg.postgres?.enabled) {
  if (!cfg.postgres.url) throw new Error("POSTGRES_URL must be set when PostgreSQL is enabled");
  if (!/^postgres(ql)?:\/\/.+\/.*$/.test(cfg.postgres.url))
    throw new Error("POSTGRES_URL must be a valid PostgreSQL connection string");
}

/* ──────────────────── Export ───────────────────────── */
export const config: EnhancedBotConfig = cfg;

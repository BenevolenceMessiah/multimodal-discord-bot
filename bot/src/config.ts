import fs from "fs";
import yaml from "js-yaml";
import { BotConfig } from "./types.js";

// Helper: replace ${VAR:-default} placeholders using process.env
function interpolate(str: string): string {
  return str.replace(/\$\{([^:}]+)(:-([^}]*))?}/g, (_, key, _2, def) => {
    return process.env[key] ?? def ?? "";
  });
}

const rawFile = fs.readFileSync("config.yaml", "utf8");
// First pass: substitute env placeholders inside YAML
const hydrated = interpolate(rawFile);
const doc = yaml.load(hydrated) as BotConfig;

// Second pass: for *any* environment variable that matches a config key
for (const [key, value] of Object.entries(process.env)) {
  const lc = key.toLowerCase();
  if (lc in doc) (doc as any)[lc] = value;
  // n8n convention: N8N_<key>
  if (lc.startsWith("n8n_")) {
    const k = lc.slice(4);
    if (k in doc) (doc as any)[k] = value;
  }
}

// Allow multiline SYSTEM_MESSAGE in .env (escaped with 
)
if (process.env.SYSTEM_MESSAGE) {
  doc.systemMessage = process.env.SYSTEM_MESSAGE.replace(/\n/g, "
");
}

export const config: BotConfig = doc;
```ts
import fs from "fs";
import yaml from "js-yaml";
import { BotConfig } from "./types.js";

const raw = yaml.load(fs.readFileSync("config.yaml", "utf8")) as BotConfig;

// allow n8n‑driven overrides via env vars prefixed N8N_
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("N8N_")) {
    const path = key.substring(4).toLowerCase();
    // naive flat override
    if (path in raw) (raw as any)[path] = value;
  }
}

export const config: BotConfig = raw;
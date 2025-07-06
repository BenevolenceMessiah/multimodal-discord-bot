import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import fetch from "node-fetch";
import { logger } from "../src/utils/logger.js";
import { config } from "../src/config.js";

/* ── Resolve paths and API base ───────────────────────────────────── */
const LORA_DIR = path.resolve(
  process.env.LORA_DIR ??
    config.endpoints?.sdForgeLoraDir ??
    "/stable-diffusion-webui-forge/models/Lora",
);

const FORGE_API =
  process.env.FORGE_HOST ??
  config.endpoints?.sdForgeHost ??
  "http://host.docker.internal:7860";

/* ── List LoRAs (fs → API fallback) ───────────────────────────────── */
export async function listLoras(): Promise<string[]> {
  try {
    const files = await fsp.readdir(LORA_DIR, { withFileTypes: true });
    const names = files
      .filter((e) => e.isFile() && e.name.endsWith(".safetensors"))
      .map((e) => path.parse(e.name).name)
      .sort((a, b) => a.localeCompare(b));
    if (names.length) return names;
    logger.warn(`listLoras: no local files, falling back to Forge API`);
  } catch {
    /* ignore, try API */
  }

  try {
    const res = await fetch(`${FORGE_API}/sdapi/v1/loras`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { name: string }[];
    return json.map((o) => o.name).sort((a, b) => a.localeCompare(b));
  } catch (e) {
    logger.error(`listLoras API fallback failed: ${e}`);
    return [];
  }
}

/* ── Local icon helper ────────────────────────────────────────────── */
export function loraIconPath(name: string): string | undefined {
  for (const ext of [".png", ".jpg", ".jpeg", ".gif"]) {
    const p = path.join(LORA_DIR, `${name}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/* ── Remote icon probe via /file= ─────────────────────────────────── */
export async function fetchRemoteIcon(
  name: string,
): Promise<Buffer | null> {
  for (const ext of [".png", ".jpg", ".jpeg", ".gif"]) {
    try {
      const u = `${FORGE_API}/file=models/Lora/${encodeURIComponent(
        name + ext,
      )}`;
      const r = await fetch(u);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch {
      /* try next extension */
    }
  }
  return null;
}

/* debug helper */
export function getLoraDir() {
  return LORA_DIR;
}

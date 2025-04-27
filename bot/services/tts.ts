import fetch from "node-fetch";
import fs from "fs/promises";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { randomUUID } from "crypto";

export async function synthesize(text: string): Promise<string> {
  return config.voicegenProvider === "alltalk" ? alltalk(text) : elevenlabs(text);
}

async function alltalk(text: string): Promise<string> {
  const form = new URLSearchParams();
  form.append("text", text);
  form.append("voice", config.modelAlltalk);
  const res = await fetch(`${config.endpoints.alltalk}/api/tts-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) throw new Error(`AllTalk error ${res.status}`);
  const wav = await res.arrayBuffer();
  const path = `/tmp/${randomUUID()}.wav`;
  await fs.writeFile(path, Buffer.from(wav));
  return path;
}

async function elevenlabs(text: string): Promise<string> {
  const res = await fetch(
    `${config.endpoints.elevenlabs}/text-to-speech/${config.modelAlltalk}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.elevenlabsKey!,
      },
      body: JSON.stringify({ text, model_id: "eleven_monolingual_v1" }),
    }
  );
  if (!res.ok) throw new Error(`ElevenLabs error ${res.status}`);
  const wav = await res.arrayBuffer();
  const path = `/tmp/${randomUUID()}.wav`;
  await fs.writeFile(path, Buffer.from(wav));
  return path;
}
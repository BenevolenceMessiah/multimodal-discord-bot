// bot/services/tts.ts
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { config } from '../src/config.js';          // your existing typed config
import qs from 'node:querystring';

/** Select the active engine. */
export async function synthesize(
  text: string,
  voiceOverride?: string,
): Promise<string> {
  if (config.voicegenProvider === 'alltalk') {
    return alltalk(text, voiceOverride);
  }
  return elevenlabs(text);
}

/* ───────────────────────────── AllTalk V2 ──────────────────────────── */
async function alltalk(text: string, voiceOverride?: string): Promise<string> {
  const voice =
    voiceOverride ||
    process.env.ALLTALK_VOICE ||
    (config as any).modelAlltalk ||
    'xtts_v2';

  /* 1️⃣  send generation request */
  const payload = qs.stringify({
    text_input: text,                                  // required ✔︎
    text_filtering: 'standard',
    character_voice_gen: voice,                        // optional
    output_file_timestamp: true,
  });

  const api = `${config.endpoints.alltalk}/api/tts-generate`;
  const res = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload,
  });

  if (!res.ok) {
    // surface FastAPI explanation if present
    const detail = await res.text();
    throw new Error(`AllTalk error ${res.status} ${detail}`); // 422 == missing field
  }

  /* 2️⃣  parse JSON & download the WAV */
  const json = (await res.json()) as {
    output_file_url: string;
    status: string;
  };

  if (json.status !== 'generate-success')
    throw new Error('AllTalk generation failed');

  const wavUrl = `${config.endpoints.alltalk}${json.output_file_url}`;
  const wavRes = await fetch(wavUrl);
  if (!wavRes.ok) throw new Error(`Cannot download WAV ${wavRes.status}`);

  const path = `/tmp/${randomUUID()}.wav`;
  await fs.writeFile(path, Buffer.from(await wavRes.arrayBuffer()));
  return path;
}

/* ─────────────────────────── ElevenLabs ───────────────────────────── */
async function elevenlabs(text: string): Promise<string> {
  const res = await fetch(
    `${config.endpoints.elevenlabs}/text-to-speech/${config.modelAlltalk}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': config.elevenlabsKey!,
      },
      body: JSON.stringify({ text, model_id: 'eleven_monolingual_v1' }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs error ${res.status}`);
  const wav = await res.arrayBuffer();
  const path = `/tmp/${randomUUID()}.wav`;
  await fs.writeFile(path, Buffer.from(wav));
  return path;
}

import fetch from "node-fetch";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

interface GenerateOpts {
  prompt: string;
  lyrics?: string;
  duration?: number;
  format?: "mp3" | "wav" | "flac";
}

/** FastAPI endpoint borrowed from `infer-api.py` */
const ENDPOINT =
  process.env.ACE_STEP_ENDPOINT ??
  "http://host.docker.internal:7867/generate";

const DEFAULTS = {
  duration: Number(process.env.ACE_STEP_DURATION ?? 240),
  format:   (process.env.ACE_STEP_FORMAT ?? "mp3") as "mp3" | "wav" | "flac",
  steps:    Number(process.env.ACE_STEP_STEPS  ?? 200)
};

/** Call ACE-Step and return the absolute path of the audio file on disk. */
export async function generateMusic(
  opts: Partial<GenerateOpts> & { prompt: string }
): Promise<string> {

  /* ---------- build request payload ---------- */
  const payload = {
    checkpoint_path: process.env.ACE_STEP_CKPT
      ?? "./checkpoints/ACE-Step-v1-3.5B",

    bf16:            true,
    torch_compile:   false,
    device_id:       0,

    audio_duration:  opts.duration ?? DEFAULTS.duration,
    prompt:          opts.prompt,
    lyrics:          opts.lyrics ?? "",
    infer_step:      DEFAULTS.steps,
    guidance_scale:  15,
    scheduler_type:  "euler",
    cfg_type:        "apg",
    omega_scale:     10,
    actual_seeds:    [Math.floor(Math.random() * 2 ** 32)],
    guidance_interval:        0.5,
    guidance_interval_decay:  0,
    min_guidance_scale:       3,
    use_erg_tag:     true,
    use_erg_lyric:   false,
    use_erg_diffusion: true,
    oss_steps:       [],
    guidance_scale_text: 0,
    guidance_scale_lyric: 0,

    /* pipeline understands both `format` + an output_path */
    format: opts.format ?? DEFAULTS.format,
    output_path: `./outputs/output_${Date.now()}.${opts.format ?? DEFAULTS.format}`,
  };

  /* ---------- node-fetch with AbortController timeout ---------- */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1000 * 60 * 8); // 8-min cap

  const res = await fetch(ENDPOINT, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify(payload),
    signal : controller.signal,
  });

  clearTimeout(timer);

  if (!res.ok) {
    throw new Error(
      `ACE-Step error ${res.status}: ${await res.text()}`
    );
  }

  /* ---------- copy result file into tmp so we can clean later ---------- */
  const { output_path } = (await res.json()) as { output_path: string };
  const tmp = path.join(tmpdir(), path.basename(output_path));
  await fs.copyFile(output_path, tmp);

  return tmp;  // caller is responsible for deletion
}

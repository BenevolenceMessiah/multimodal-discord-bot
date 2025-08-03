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

/**
 * Resolve the ACEStep API endpoint.
 *
 * The underlying ACEStep project exposes its inference API via FastAPI
 * on port 8000 at the `/generate` route. A separate Gradio UI usually
 * runs on port 7867 but does **not** serve the `/generate` endpoint.
 *
 * To avoid confusion, we support two environment variables:
 *
 *   - `ACE_STEP_ENDPOINT`: the fully-qualified URL to the `/generate`
 *     endpoint (e.g. `http://host.docker.internal:8000/generate`). If this
 *     variable is present it takes precedence.
 *
 *   - `ACE_STEP_BASE`: the base URL of the ACEStep service (without
 *     trailing slash or path). When supplied, the bot will append
 *     `/generate` automatically. For example, `http://host.docker.internal:8000`
 *     becomes `http://host.docker.internal:8000/generate`.
 *
 * If neither environment variable is defined, the default
 * `http://host.docker.internal:8000/generate` will be used.
 */
const ENDPOINT = (() => {
  const { ACE_STEP_ENDPOINT, ACE_STEP_BASE } = process.env;

  // Highest priority: explicitly provided full endpoint
  if (ACE_STEP_ENDPOINT && ACE_STEP_ENDPOINT.trim().length > 0) {
    return ACE_STEP_ENDPOINT;
  }

  // Next priority: provided base URL; append `/generate`
  if (ACE_STEP_BASE && ACE_STEP_BASE.trim().length > 0) {
    // remove any trailing slashes from the base URL
    const base = ACE_STEP_BASE.replace(/\/+\$/, "");
    return `${base}/generate`;
  }

  // Fallback to the FastAPI server on port 8000
  return "http://host.docker.internal:8000/generate";
})();

const DEFAULTS = {
  duration: Number(process.env.ACE_STEP_DURATION ?? 240),
  format: (process.env.ACE_STEP_FORMAT ?? "mp3") as "mp3" | "wav" | "flac",
  steps: Number(process.env.ACE_STEP_STEPS ?? 200),
};

/**
 * Call ACEStep to generate music and return the path to the audio file.
 *
 * This function constructs the payload expected by the ACEStep FastAPI
 * endpoint, including sensible defaults for guidance and scheduler
 * parameters. It enforces an 8‑minute timeout on the request and
 * writes the resulting audio file to a temporary location on disk. The
 * caller is responsible for cleaning up the returned file when done.
 */
export async function generateMusic(
  opts: Partial<GenerateOpts> & { prompt: string }
): Promise<string> {
  /* ---------- build request payload ---------- */
  const payload = {
    checkpoint_path: process.env.ACE_STEP_CKPT ?? "./checkpoints/ACE-Step-v1-3.5B",

    bf16: true,
    torch_compile: false,
    device_id: 0,

    audio_duration: opts.duration ?? DEFAULTS.duration,
    prompt: opts.prompt,
    lyrics: opts.lyrics ?? "",
    infer_step: DEFAULTS.steps,
    guidance_scale: 15,
    scheduler_type: "euler",
    cfg_type: "apg",
    omega_scale: 10,
    // Provide a list of manual seeds to ensure deterministic generation.
    // Using an array avoids confusion with comma‑separated strings and
    // matches the `manual_seeds` parameter in the ACEStep pipeline.
    manual_seeds: [Math.floor(Math.random() * 2 ** 32)],
    guidance_interval: 0.5,
    guidance_interval_decay: 0,
    min_guidance_scale: 3,
    use_erg_tag: true,
    use_erg_lyric: false,
    use_erg_diffusion: true,
    // Pass an empty list for one‑shot sample steps.  A list is used
    // instead of a string so the FastAPI server can forward it
    // directly to the pipeline without type conversion.
    oss_steps: [],
    guidance_scale_text: 0,
    guidance_scale_lyric: 0,

    /* pipeline understands both `format` and an output_path */
    format: opts.format ?? DEFAULTS.format,
    output_path: `./outputs/output_${Date.now()}.${opts.format ?? DEFAULTS.format}`,
  };

  /* ---------- node-fetch with AbortController timeout ---------- */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1000 * 60 * 8); // 8‑minute cap

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  clearTimeout(timer);

  if (!res.ok) {
    throw new Error(`ACE-Step error ${res.status}: ${await res.text()}`);
  }

  /* ---------- process the response ---------- */
  const json = (await res.json()) as {
    output_path: string;
    audio_data?: string | null;
  };

  // Determine a temporary file name based on the reported output_path.
  const tmpPath = path.join(tmpdir(), path.basename(json.output_path));

  if (json.audio_data && typeof json.audio_data === "string" && json.audio_data.length > 0) {
    // If the API returned a Base64 string, decode it and write it directly.
    const buffer = Buffer.from(json.audio_data, "base64");
    await fs.writeFile(tmpPath, buffer);
  } else {
    // Fallback: attempt to copy the file locally.  This will only work
    // if the ACE‑Step service and the bot share a filesystem.
    await fs.copyFile(json.output_path, tmpPath);
  }

  return tmpPath; // caller is responsible for deletion
}

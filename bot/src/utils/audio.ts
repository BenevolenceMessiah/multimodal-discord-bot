import ffmpeg, { FfprobeData } from "fluent-ffmpeg";
import { statSync } from "node:fs";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const LIMIT = Number(process.env.DISCORD_UPLOAD_LIMIT_BYTES ?? 9_500_000);

/* Promisified ffprobe with real return type */
const _ffprobe = promisify(ffmpeg.ffprobe) as (p: string) => Promise<FfprobeData>;

/** Slice any audio file (wav/flac/mp3/ogg…) into ≤ LIMIT-byte chunks via stream-copy */
export async function chunkAudio(srcPath: string) {
  if (statSync(srcPath).size <= LIMIT) return [srcPath];

  const { format: { duration } } = await _ffprobe(srcPath);
  if (!duration) throw new Error("ffprobe failed to read duration");

  const bytesPerSec = statSync(srcPath).size / duration;
  const maxSec      = Math.max(1, Math.floor(LIMIT / bytesPerSec) - 1);

  const chunks: string[] = [];
  for (let start = 0; start < duration; start += maxSec) {
    const out = path.join(
      tmpdir(),
      `${path.basename(srcPath)}_${start}${path.extname(srcPath)}`
    );
    await new Promise<void>((ok, bad) =>
      ffmpeg(srcPath)
        .setStartTime(start)
        .setDuration(Math.min(maxSec, duration - start))
        .outputOptions("-c:a", "copy")
        .on("end", () => ok())
        .on("error", (err: Error) => bad(err))
        .save(out),
    );
    chunks.push(out);
  }
  await fs.unlink(srcPath); // remove the big original
  return chunks;
}

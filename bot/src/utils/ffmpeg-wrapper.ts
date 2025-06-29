//  src/utils/ffmpeg-wrapper.ts
import ffmpeg from 'fluent-ffmpeg';

/** Slice any audio file via stream-copy. */
export async function sliceAudio(
  src: string,
  start: number,
  dur: number,
  out: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg(src)
      .setStartTime(start)
      .setDuration(dur)
      .outputOptions('-c:a', 'copy')
      // callback must accept (stdout, stderr) even if you ignore them
      .on('end', () => resolve())
      .on('error', reject)
      .save(out);
  });
}

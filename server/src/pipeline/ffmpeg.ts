import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

export interface ClipSpec {
  start_sec: number;
  end_sec: number;
  position: number;
}

async function getVideoCodec(videoPath: string): Promise<string> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    videoPath,
  ]);
  return stdout.trim();
}

async function transcodeToH264(videoPath: string, outputDir: string): Promise<string> {
  const outPath = path.join(outputDir, 'video_h264.mp4');
  console.log('[ffmpeg] pre-transcoding to h264...');
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-c:v', 'libx264', '-preset', 'ultrafast',
    '-c:a', 'aac',
    '-y',
    outPath,
  ]);
  console.log('[ffmpeg] pre-transcode complete');
  return outPath;
}

export async function cutClips(videoPath: string, clips: ClipSpec[], outputDir: string): Promise<{ clipPaths: string[]; thumbPaths: string[] }> {
  await fs.mkdir(outputDir, { recursive: true });

  const codec = await getVideoCodec(videoPath);
  const needsTranscode = codec !== 'h264';
  const sourceVideo = needsTranscode ? await transcodeToH264(videoPath, outputDir) : videoPath;
  if (needsTranscode) console.log(`[ffmpeg] input codec was ${codec}, using transcoded h264 source`);

  const clipPaths: string[] = [];
  const thumbPaths: string[] = [];

  for (const clip of clips) {
    const clipPath = path.join(outputDir, `clip_${clip.position}.mp4`);
    const thumbPath = path.join(outputDir, `thumb_${clip.position}.jpg`);
    const duration = clip.end_sec - clip.start_sec;

    console.log(`[ffmpeg] cutting clip ${clip.position} (${clip.start_sec}s–${clip.end_sec}s)`);
    await execFileAsync('ffmpeg', [
      '-ss', String(clip.start_sec),
      '-i', sourceVideo,
      '-t', String(duration),
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y',
      clipPath,
    ]);

    await execFileAsync('ffmpeg', [
      '-ss', String(clip.start_sec + 0.5),
      '-i', sourceVideo,
      '-frames:v', '1',
      '-q:v', '3',
      '-y',
      thumbPath,
    ]);

    console.log(`[ffmpeg] done clip ${clip.position}`);
    clipPaths.push(clipPath);
    thumbPaths.push(thumbPath);
  }

  return { clipPaths, thumbPaths };
}

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

export async function cutClips(videoPath: string, clips: ClipSpec[], outputDir: string): Promise<{ clipPaths: string[]; thumbPaths: string[] }> {
  await fs.mkdir(outputDir, { recursive: true });

  const clipPaths: string[] = [];
  const thumbPaths: string[] = [];

  for (const clip of clips) {
    const clipPath = path.join(outputDir, `clip_${clip.position}.mp4`);
    const thumbPath = path.join(outputDir, `thumb_${clip.position}.jpg`);
    const duration = clip.end_sec - clip.start_sec;

    console.log(`[ffmpeg] cutting clip ${clip.position} (${clip.start_sec}s–${clip.end_sec}s)`);
    await execFileAsync('ffmpeg', [
      '-ss', String(clip.start_sec),
      '-i', videoPath,
      '-t', String(duration),
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-y',
      clipPath,
    ]);

    // Extract first frame as thumbnail
    await execFileAsync('ffmpeg', [
      '-ss', String(clip.start_sec + 0.5),
      '-i', videoPath,
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

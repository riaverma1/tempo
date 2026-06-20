import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

export type MovementMode = 'timed' | 'reps';

export interface OcrFrame {
  sec: number;
  text: string;
}

export async function extractFrames(videoPath: string, framesDir: string): Promise<void> {
  await fs.mkdir(framesDir, { recursive: true });
  // 1 frame per second, output as frame_0001.png, frame_0002.png ...
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-vf', 'fps=1',
    path.join(framesDir, 'frame_%04d.png'),
    '-y',
  ]);
}

export async function runOcr(framesDir: string): Promise<OcrFrame[]> {
  const files = (await fs.readdir(framesDir))
    .filter((f) => f.endsWith('.png'))
    .sort();

  const results: OcrFrame[] = [];

  for (let i = 0; i < files.length; i++) {
    const framePath = path.join(framesDir, files[i]);
    try {
      const { stdout } = await execFileAsync('tesseract', [framePath, 'stdout', '--psm', '6']);
      results.push({ sec: i, text: stdout.trim() });
    } catch {
      results.push({ sec: i, text: '' });
    }
  }

  return results;
}

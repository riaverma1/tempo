import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { COOKIES_PATH } from '../index';

const execFileAsync = promisify(execFile);

export async function downloadVideo(url: string, outputDir: string): Promise<{ path: string } | null> {
  const outputTemplate = path.join(outputDir, 'video.%(ext)s');
  const cookiesExist = await fs.access(COOKIES_PATH).then(() => true).catch(() => false);
  const cookiesArgs = cookiesExist ? ['--cookies', COOKIES_PATH] : [];
  try {
    await execFileAsync('yt-dlp', [
      '--no-playlist',
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '-o', outputTemplate,
      ...cookiesArgs,
      url,
    ]);
    return { path: path.join(outputDir, 'video.mp4') };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/private video|sign in|login required|not available/i.test(msg)) {
      throw new Error('This video is private or requires login. Download it and upload from your camera roll.');
    }
    console.error('[download] yt-dlp failed:', msg);
    return null;
  }
}

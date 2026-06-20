import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

const execFileAsync = promisify(execFile);

export async function downloadWithYtDlp(url: string, outputDir: string): Promise<string> {
  const outputTemplate = path.join(outputDir, 'video.%(ext)s');
  await execFileAsync('yt-dlp', [
    '--no-playlist',
    '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '-o', outputTemplate,
    url,
  ]);
  return path.join(outputDir, 'video.mp4');
}

export async function downloadWithCobalt(url: string, outputDir: string): Promise<string> {
  const cobaltUrl = process.env.COBALT_URL;
  if (!cobaltUrl) throw new Error('COBALT_URL not configured');

  const res = await fetch(`${cobaltUrl}/api/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ url, vQuality: 'max', filenamePattern: 'basic' }),
  });

  if (!res.ok) throw new Error(`Cobalt API error: ${res.status}`);
  const data = await res.json() as { status: string; url?: string };
  if (!data.url) throw new Error('Cobalt returned no download URL');

  // Stream to disk
  const fileRes = await fetch(data.url);
  if (!fileRes.ok) throw new Error('Failed to download from Cobalt URL');

  const outPath = path.join(outputDir, 'video.mp4');
  const dest = fs.createWriteStream(outPath);
  await new Promise<void>((resolve, reject) => {
    fileRes.body!.pipe(dest);
    dest.on('finish', resolve);
    dest.on('error', reject);
  });
  return outPath;
}

export async function downloadVideo(url: string, outputDir: string): Promise<{ path: string; method: 'yt-dlp' | 'cobalt' } | null> {
  try {
    const p = await downloadWithYtDlp(url, outputDir);
    return { path: p, method: 'yt-dlp' };
  } catch (err) {
    // Surface auth/private errors immediately — no point trying Cobalt
    const msg = err instanceof Error ? err.message : String(err);
    if (/private video|sign in|login required|not available/i.test(msg)) {
      throw new Error('This video is private or requires login. Download it and upload from your camera roll.');
    }
    console.error('[download] yt-dlp failed, trying Cobalt:', msg);
  }

  try {
    const p = await downloadWithCobalt(url, outputDir);
    return { path: p, method: 'cobalt' };
  } catch (err) {
    console.error('[download] Cobalt also failed:', err instanceof Error ? err.message : err);
  }

  return null;
}

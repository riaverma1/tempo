import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook';

// Returns the known video platform for a URL, or null if it's not one —
// callers treat null as "this is a generic webpage" rather than assuming
// every URL is a video.
export function detectVideoPlatform(url: string): VideoPlatform | null {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/tiktok\.com|vm\.tiktok\.com/.test(url)) return 'tiktok';
  if (/instagram\.com\/reel/.test(url)) return 'instagram';
  if (/facebook\.com|fb\.watch/.test(url)) return 'facebook';
  return null;
}

// Kept for the video pipeline, which only ever calls this on URLs it has
// already confirmed (via detectVideoPlatform) are a known video platform.
export function detectPlatform(url: string): VideoPlatform | 'uploaded' {
  return detectVideoPlatform(url) ?? 'uploaded';
}

export function getVideoThumbnailUrl(url: string): string | null {
  if (detectPlatform(url) !== 'youtube') return null;
  const id = extractVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function getTitleViaYtDlp(url: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--no-download',
      '--no-playlist',
      url,
    ]);
    const info = JSON.parse(stdout) as { title?: string };
    return info.title ?? null;
  } catch (err) {
    console.error('[chapters] yt-dlp --dump-json failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getVideoTitle(url: string): Promise<string | null> {
  if (detectPlatform(url) !== 'youtube') {
    return getTitleViaYtDlp(url);
  }

  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (apiKey) {
    const videoId = extractVideoId(url);
    if (videoId) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`
        );
        if (res.ok) {
          const data = await res.json() as { items?: Array<{ snippet: { title: string } }> };
          const title = data.items?.[0]?.snippet.title;
          if (title) return title;
        }
      } catch (err) {
        console.error('[chapters] YouTube Data API failed, falling back to yt-dlp:', err instanceof Error ? err.message : err);
      }
    }
  }

  return getTitleViaYtDlp(url);
}

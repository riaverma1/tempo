import fetch from 'node-fetch';

export interface Chapter {
  label: string;
  start_sec: number;
  end_sec: number;
}

export interface VideoMeta {
  title: string;
  chapters: Chapter[] | null;
}

export function getYoutubeThumbnailUrl(url: string): string | null {
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

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(parts[0]);
}

// Parse "0:00 Jump Squats\n0:30 Push-Ups" from description
function parseDescriptionChapters(description: string, videoDurationSec: number): Chapter[] {
  const lines = description.split('\n');
  const chapterRegex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
  const found: { start_sec: number; label: string }[] = [];

  for (const line of lines) {
    const m = line.trim().match(chapterRegex);
    if (m) {
      found.push({ start_sec: parseTimestamp(m[1]), label: m[2].trim() });
    }
  }

  if (found.length < 2) return [];

  return found.map((ch, i) => ({
    label: ch.label,
    start_sec: ch.start_sec,
    end_sec: found[i + 1]?.start_sec ?? videoDurationSec,
  }));
}

export async function getChapters(url: string): Promise<VideoMeta | null> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) return null;

  const videoId = extractVideoId(url);
  if (!videoId) return null;

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${apiKey}`
  );
  if (!res.ok) return null;

  const data = await res.json() as { items?: Array<{ snippet: { title: string; description: string }; contentDetails: { duration: string } }> };
  const item = data.items?.[0];
  if (!item) return null;

  const title = item.snippet.title;

  // Parse ISO 8601 duration (PT4M30S → 270)
  const iso = item.contentDetails.duration;
  const durationMatch = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const durationSec = durationMatch
    ? (Number(durationMatch[1] ?? 0) * 3600 + Number(durationMatch[2] ?? 0) * 60 + Number(durationMatch[3] ?? 0))
    : 0;

  const chapters = parseDescriptionChapters(item.snippet.description, durationSec);
  return { title, chapters: chapters.length > 0 ? chapters : null };
}

export async function getVideoTitle(url: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) return null;
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`
  );
  if (!res.ok) return null;
  const data = await res.json() as { items?: Array<{ snippet: { title: string } }> };
  return data.items?.[0]?.snippet.title ?? null;
}

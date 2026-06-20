import { describe, it, expect } from 'vitest';

// Test the description-parsing logic directly (without API calls)
// We inline the parser here to avoid needing env vars in tests.

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(parts[0]);
}

function parseDescriptionChapters(description: string, videoDurationSec: number) {
  const lines = description.split('\n');
  const chapterRegex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
  const found: { start_sec: number; label: string }[] = [];
  for (const line of lines) {
    const m = line.trim().match(chapterRegex);
    if (m) found.push({ start_sec: parseTimestamp(m[1]), label: m[2].trim() });
  }
  if (found.length < 2) return [];
  return found.map((ch, i) => ({
    label: ch.label,
    start_sec: ch.start_sec,
    end_sec: found[i + 1]?.start_sec ?? videoDurationSec,
  }));
}

describe('parseDescriptionChapters', () => {
  it('parses standard chapter format', () => {
    const desc = '0:00 Warm Up\n0:30 Jump Squats\n1:00 Push-Ups\n1:30 Cool Down';
    const chapters = parseDescriptionChapters(desc, 120);
    expect(chapters).toHaveLength(4);
    expect(chapters[0]).toEqual({ label: 'Warm Up', start_sec: 0, end_sec: 30 });
    expect(chapters[1]).toEqual({ label: 'Jump Squats', start_sec: 30, end_sec: 60 });
    expect(chapters[3].end_sec).toBe(120); // last chapter ends at video duration
  });

  it('returns empty array for fewer than 2 chapters', () => {
    const desc = '0:00 Only one chapter';
    expect(parseDescriptionChapters(desc, 60)).toHaveLength(0);
  });

  it('handles hour:min:sec timestamps', () => {
    const desc = '0:00:00 Start\n0:05:30 Middle\n0:10:00 End';
    const chapters = parseDescriptionChapters(desc, 600);
    expect(chapters[0].start_sec).toBe(0);
    expect(chapters[1].start_sec).toBe(330);
    expect(chapters[2].start_sec).toBe(600);
  });

  it('ignores lines that are not timestamps', () => {
    const desc = 'Great workout video!\n0:00 Squats\n0:30 Lunges\nSubscribe for more!';
    const chapters = parseDescriptionChapters(desc, 60);
    expect(chapters).toHaveLength(2);
  });
});

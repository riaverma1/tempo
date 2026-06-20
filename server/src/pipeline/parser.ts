import { MovementMode } from './ocr';

export interface ParsedSegment {
  name: string;
  mode: MovementMode;
  start_sec: number;
  end_sec: number;
  duration_sec: number | null;
  reps: number | null;
  sets: number | null;
}

// "30 sec", "0:45", "45s" → seconds
function parseDuration(text: string): number | null {
  const minSec = text.match(/(\d+):(\d{2})/);
  if (minSec) return Number(minSec[1]) * 60 + Number(minSec[2]);
  const secLabel = text.match(/(\d+)\s*s(?:ec(?:onds?)?)?\b(?!\w)/i);
  if (secLabel) return Number(secLabel[1]);
  return null;
}

// "3 sets of 8", "3x8", "x12", "12 reps" → { sets, reps }
function parseReps(text: string): { sets: number; reps: number } | null {
  const setsOf = text.match(/(\d+)\s*(?:sets?\s*of|x)\s*(\d+)/i);
  if (setsOf) return { sets: Number(setsOf[1]), reps: Number(setsOf[2]) };
  const xReps = text.match(/x\s*(\d+)/i);
  if (xReps) return { sets: 3, reps: Number(xReps[1]) }; // assume 3 sets when only reps given
  const repsOnly = text.match(/(\d+)\s*reps?/i);
  if (repsOnly) return { sets: 3, reps: Number(repsOnly[1]) };
  return null;
}

export function inferMode(text: string): {
  mode: MovementMode;
  duration_sec: number | null;
  reps: number | null;
  sets: number | null;
} {
  const durSec = parseDuration(text);
  if (durSec !== null) {
    return { mode: 'timed', duration_sec: durSec, reps: null, sets: null };
  }

  const repInfo = parseReps(text);
  if (repInfo) {
    return { mode: 'reps', duration_sec: null, reps: repInfo.reps, sets: repInfo.sets };
  }

  // Default: timed with no explicit duration — treat as 30s
  return { mode: 'timed', duration_sec: 30, reps: null, sets: null };
}

export function segmentsFromOcrFrames(
  frames: Array<{ sec: number; text: string }>,
  videoDurationSec: number
): ParsedSegment[] {
  if (frames.length === 0) return [];

  const segments: ParsedSegment[] = [];
  let currentText = frames[0].text;
  let startSec = frames[0].sec;

  const flush = (endSec: number) => {
    if (!currentText.trim()) return;
    const modeInfo = inferMode(currentText);
    // Extract exercise name: first line or everything before a pipe/dash
    const namePart = currentText.split(/\n|\s+[|—–\-]\s+/)[0].trim();
    if (!namePart || namePart.length < 3) return;
    segments.push({
      name: namePart,
      ...modeInfo,
      start_sec: startSec,
      end_sec: endSec,
    });
  };

  for (let i = 1; i < frames.length; i++) {
    const { sec, text } = frames[i];
    // New segment when text content changes meaningfully
    if (text.trim() !== currentText.trim() && text.trim().length > 0) {
      flush(sec);
      currentText = text;
      startSec = sec;
    }
  }
  flush(videoDurationSec);

  return segments;
}

import { describe, it, expect } from 'vitest';
import { inferMode, segmentsFromOcrFrames } from '../../src/pipeline/parser';

describe('inferMode', () => {
  it('parses "30 sec" as timed', () => {
    const r = inferMode('Jump Squats\n30 sec');
    expect(r.mode).toBe('timed');
    expect(r.duration_sec).toBe(30);
  });

  it('parses "0:45" timestamp as timed', () => {
    const r = inferMode('SQUATS | 0:45');
    expect(r.mode).toBe('timed');
    expect(r.duration_sec).toBe(45);
  });

  it('parses "45s" shorthand as timed', () => {
    const r = inferMode('Lunges 45s');
    expect(r.mode).toBe('timed');
    expect(r.duration_sec).toBe(45);
  });

  it('parses "3 sets of 8" as reps', () => {
    const r = inferMode('Circuit 1 - 3 sets of 8');
    expect(r.mode).toBe('reps');
    expect(r.sets).toBe(3);
    expect(r.reps).toBe(8);
  });

  it('parses "3x12" as reps', () => {
    const r = inferMode('Push-Ups 3x12');
    expect(r.mode).toBe('reps');
    expect(r.sets).toBe(3);
    expect(r.reps).toBe(12);
  });

  it('parses "x12" as reps with default 3 sets', () => {
    const r = inferMode('Squats x12');
    expect(r.mode).toBe('reps');
    expect(r.reps).toBe(12);
    expect(r.sets).toBe(3);
  });

  it('parses "12 reps" as reps', () => {
    const r = inferMode('Deadlifts 12 reps');
    expect(r.mode).toBe('reps');
    expect(r.reps).toBe(12);
  });

  it('defaults to timed 30s when no cues found', () => {
    const r = inferMode('PLANK');
    expect(r.mode).toBe('timed');
    expect(r.duration_sec).toBe(30);
  });
});

describe('segmentsFromOcrFrames', () => {
  it('creates a segment for each distinct text block', () => {
    const frames = [
      { sec: 0, text: 'Jump Squats\n30 sec' },
      { sec: 1, text: 'Jump Squats\n30 sec' },
      { sec: 2, text: 'Jump Squats\n30 sec' },
      { sec: 3, text: 'Push-Ups\n3 sets of 8' },
      { sec: 4, text: 'Push-Ups\n3 sets of 8' },
    ];
    const segs = segmentsFromOcrFrames(frames, 5);
    expect(segs).toHaveLength(2);
    expect(segs[0].name).toBe('Jump Squats');
    expect(segs[0].mode).toBe('timed');
    expect(segs[1].name).toBe('Push-Ups');
    expect(segs[1].mode).toBe('reps');
  });

  it('returns empty array for empty frames', () => {
    expect(segmentsFromOcrFrames([], 0)).toHaveLength(0);
  });

  it('skips frames with empty text', () => {
    const frames = [
      { sec: 0, text: '' },
      { sec: 1, text: 'Plank Hold\n45s' },
      { sec: 2, text: 'Plank Hold\n45s' },
    ];
    const segs = segmentsFromOcrFrames(frames, 3);
    expect(segs).toHaveLength(1);
    expect(segs[0].name).toBe('Plank Hold');
  });

  it('does not create a new segment when text is unchanged', () => {
    const frames = Array.from({ length: 10 }, (_, i) => ({ sec: i, text: 'Squats\n30 sec' }));
    const segs = segmentsFromOcrFrames(frames, 10);
    expect(segs).toHaveLength(1);
  });
});

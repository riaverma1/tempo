/**
 * Seed script: populates Supabase with a known-good YouTube workout video.
 * Run once after setting up the DB schema.
 *
 * Usage: npx tsx scripts/seed.ts
 *
 * Uses a Pamela Reif video with clear text overlays (good for OCR).
 * After running, set EXPO_PUBLIC_USE_MOCK=false and the app will render real data.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Fixture movements — mix of timed and reps, represents a typical OCR-parsed video
const SEED_MOVEMENTS = [
  { position: 0, name: 'Jump Squats', mode: 'timed', start_sec: 0, end_sec: 30, duration_sec: 30, reps: null, sets: null },
  { position: 1, name: 'Push-Ups', mode: 'reps', start_sec: 35, end_sec: 65, duration_sec: null, reps: 12, sets: 3 },
  { position: 2, name: 'Plank Hold', mode: 'timed', start_sec: 70, end_sec: 115, duration_sec: 45, reps: null, sets: null },
  { position: 3, name: 'Bulgarian Split Squats', mode: 'reps', start_sec: 120, end_sec: 165, duration_sec: null, reps: 8, sets: 3 },
  { position: 4, name: 'Glute Bridges', mode: 'timed', start_sec: 170, end_sec: 200, duration_sec: 30, reps: null, sets: null },
] as const;

const SEED_URL = 'https://www.youtube.com/watch?v=ixkQnbsO0YQ'; // Pamela Reif 20 min Ab Workout
const PLACEHOLDER_CLIP = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

async function seed() {
  // Get first user or use a placeholder
  const { data: { users } } = await db.auth.admin.listUsers();
  const userId = users?.[0]?.id;
  if (!userId) {
    console.error('No users found. Sign in to the app first, then re-run this seed.');
    process.exit(1);
  }

  // Source video
  const sourceVideoId = crypto.randomUUID();
  const { error: svErr } = await db.from('source_videos').insert({
    id: sourceVideoId,
    user_id: userId,
    original_url: SEED_URL,
    platform: 'youtube',
    title: 'Pamela Reif — 20 Min Full Body HIIT',
    duration_sec: 1200,
    processing_status: 'complete',
    processed_at: new Date().toISOString(),
  });
  if (svErr) { console.error('source_videos insert failed:', svErr.message); process.exit(1); }

  // Movements
  const movementRows = SEED_MOVEMENTS.map((m) => ({
    ...m,
    id: crypto.randomUUID(),
    source_video_id: sourceVideoId,
    clip_url: PLACEHOLDER_CLIP,
    detection_method: 'ocr',
    confidence: 0.9,
  }));
  const { error: mErr } = await db.from('movements').insert(movementRows);
  if (mErr) { console.error('movements insert failed:', mErr.message); process.exit(1); }

  // Workout
  const workoutId = crypto.randomUUID();
  const { error: wErr } = await db.from('workouts').insert({
    id: workoutId,
    user_id: userId,
    title: 'Pamela Reif — 20 Min Full Body HIIT',
    source_video_id: sourceVideoId,
    total_duration_sec: 1200,
  });
  if (wErr) { console.error('workouts insert failed:', wErr.message); process.exit(1); }

  // workout_movements
  const wmRows = movementRows.map((m, i) => ({
    id: crypto.randomUUID(),
    workout_id: workoutId,
    movement_id: m.id,
    position: i,
  }));
  const { error: wmErr } = await db.from('workout_movements').insert(wmRows);
  if (wmErr) { console.error('workout_movements insert failed:', wmErr.message); process.exit(1); }

  console.log(`✓ Seeded workout ${workoutId} with ${movementRows.length} movements for user ${userId}`);
  console.log(`  Open the app → Library to see it.`);
}

seed();

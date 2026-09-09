import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { db } from '../db/client';
import { downloadVideo } from '../pipeline/download';
import { getVideoTitle, getVideoThumbnailUrl } from '../pipeline/chapters';
import { ParsedSegment, analyzeWithTwelveLabs } from '../pipeline/twelvelabs';
import { cutClips, ClipSpec } from '../pipeline/ffmpeg';
import { uploadClip } from '../pipeline/upload';
import { extractPdfText, extractPdfImages, renderPdfPagesToImages } from '../pipeline/textInput';
import { interpretExercises } from '../pipeline/llmInterpret';
import { expandToMovements, FlatMovement } from '../pipeline/expand';

export type Platform =
  | 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'uploaded'
  | 'pdf' | 'text';

type JobStatus =
  | 'pending' | 'downloading' | 'analyzing' | 'cutting_clips' | 'uploading' | 'complete' | 'failed';

const TEXT_PLATFORMS: Platform[] = ['pdf', 'text'];

interface MovementRow {
  id: string;
  source_video_id: string;
  position: number;
  name: string;
  mode: string;
  start_sec: number | null;
  end_sec: number | null;
  duration_sec: number | null;
  reps: number | null;
  sets: number | null;
  clip_url: string | null;
  thumbnail_url: string | null;
  detection_method: string;
  confidence: number;
  is_rest: boolean;
  auto_generated: boolean;
}

const log = (jobId: string, msg: string) =>
  console.log(`[job:${jobId.slice(0, 8)}] ${msg}`);

async function updateJob(
  jobId: string,
  update: { status?: JobStatus; segments_found?: number; detection_method_used?: string; error?: string }
) {
  if (update.status) log(jobId, `→ ${update.status}`);
  await db.from('processing_jobs').update({ ...update, updated_at: new Date().toISOString() }).eq('id', jobId);
}

export async function processJob(params: {
  jobId: string;
  userId: string;
  url?: string;
  filePath?: string;
  text?: string;
  platform: Platform;
}) {
  const { jobId, userId, platform } = params;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tempo-'));

  try {
    if (TEXT_PLATFORMS.includes(platform)) {
      await runTextPipeline({ ...params, tmpDir });
    } else {
      await runVideoPipeline({ ...params, tmpDir });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log(jobId, `FAILED: ${message}`);
    await updateJob(jobId, { status: 'failed', error: message });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

// ─── Text pipeline: PDF / plain text ─────────────────────────────────────────
// Routing (which extraction method to use) and expansion (turning reps/sets
// into a flat move/rest sequence) are both plain code. The only step that
// isn't deterministic is interpretExercises — reading natural language and
// deciding what it means.
async function runTextPipeline(params: {
  jobId: string;
  userId: string;
  url?: string;
  filePath?: string;
  text?: string;
  platform: Platform;
  tmpDir: string;
}) {
  const { jobId, userId, url, filePath, platform, tmpDir } = params;
  log(jobId, `starting — platform: ${platform}`);

  await updateJob(jobId, { status: 'analyzing' });

  let text = params.text ?? '';
  let title = 'Workout';
  let imagePaths: string[] = [];

  if (platform === 'pdf') {
    if (!filePath) throw new Error('Missing filePath for PDF input');
    const pdf = await extractPdfText(filePath);
    if (pdf.usable) {
      text = pdf.text;
      imagePaths = await extractPdfImages(filePath, path.join(tmpDir, 'images'));
    } else {
      log(jobId, 'PDF text layer too sparse — rendering pages to images instead');
      imagePaths = await renderPdfPagesToImages(filePath, path.join(tmpDir, 'pages'));
      text = 'This PDF has no usable text layer — read the exercise instructions from the attached page images.';
    }
    title = 'Workout';
  } else {
    // plain text — already in the right shape, nothing to extract
    title = text.split('\n')[0]?.slice(0, 60) || 'Workout';
  }

  const exercises = await interpretExercises({ text, imagePaths });
  const flat: FlatMovement[] = expandToMovements(exercises);

  log(jobId, `${flat.length} movements from ${exercises.length} exercises via llm_text`);
  await updateJob(jobId, { segments_found: flat.length, detection_method_used: 'llm_text' });

  const sourceVideoId = crypto.randomUUID();

  await updateJob(jobId, { status: 'uploading' });

  // Upload each referenced image once (several flattened reps of the same
  // exercise share one image_index) and reuse the URL across all of them.
  const uniqueImageIndices = [...new Set(flat.map((m) => m.image_index).filter((i): i is number => i != null))];
  const imageUrlByIndex = new Map<number, string>();
  for (const idx of uniqueImageIndices) {
    const localPath = imagePaths[idx];
    if (!localPath) continue;
    const storagePath = `${userId}/${sourceVideoId}/thumb_${idx}.png`;
    imageUrlByIndex.set(idx, await uploadClip(localPath, storagePath, 'image/png'));
  }

  const movementRows: MovementRow[] = flat.map((m, i) => ({
    id: crypto.randomUUID(),
    source_video_id: sourceVideoId,
    position: i,
    name: m.name,
    mode: m.mode,
    start_sec: null,
    end_sec: null,
    duration_sec: m.duration_sec,
    reps: m.reps,
    sets: m.sets,
    clip_url: null,
    thumbnail_url: m.image_index != null ? imageUrlByIndex.get(m.image_index) ?? null : null,
    detection_method: 'llm_text',
    confidence: 0.7,
    is_rest: m.is_rest,
    auto_generated: m.auto_generated,
  }));

  const sourceThumbUrl = imageUrlByIndex.size > 0 ? [...imageUrlByIndex.values()][0] : null;
  const { error: svErr } = await db.from('source_videos').insert({
    id: sourceVideoId,
    user_id: userId,
    original_url: url ?? null,
    platform,
    title,
    thumbnail_url: sourceThumbUrl,
    processing_status: 'complete',
    processed_at: new Date().toISOString(),
  });
  if (svErr) throw new Error(svErr.message);

  const { error: movErr } = await db.from('movements').insert(movementRows);
  if (movErr) throw new Error(movErr.message);

  const workoutId = crypto.randomUUID();
  const { error: wErr } = await db.from('workouts').insert({
    id: workoutId,
    user_id: userId,
    title,
    source_video_id: sourceVideoId,
  });
  if (wErr) throw new Error(wErr.message);

  const workoutMovements = movementRows.map((m, i) => ({
    id: crypto.randomUUID(),
    workout_id: workoutId,
    movement_id: m.id,
    position: i,
  }));
  await db.from('workout_movements').insert(workoutMovements);

  await db.from('processing_jobs').update({
    status: 'complete',
    source_video_id: sourceVideoId,
    updated_at: new Date().toISOString(),
  }).eq('id', jobId);
}

// ─── Video pipeline: existing behavior, unchanged ───────────────────────────
async function runVideoPipeline(params: {
  jobId: string;
  userId: string;
  url?: string;
  filePath?: string;
  platform: Platform;
  tmpDir: string;
}) {
  const { jobId, userId, url, filePath, platform, tmpDir } = params;

  log(jobId, `starting — platform: ${platform}, url: ${url ?? 'file upload'}`);

  // 1. Cache check
  if (url) {
    const { data: cached } = await db
      .from('source_videos')
      .select('id, title, workouts(id), movements(id, position, name, mode, start_sec, end_sec, duration_sec, reps, sets, clip_url, thumbnail_url, detection_method, confidence, is_rest, auto_generated)')
      .eq('original_url', url)
      .eq('processing_status', 'complete')
      .single();

    if (cached) {
      const cachedTyped = cached as unknown as {
        id: string;
        title: string;
        workouts: Array<{ id: string }>;
        movements: MovementRow[];
      };

      const existingWorkoutId = cachedTyped.workouts?.[0]?.id;
      if (existingWorkoutId) {
        log(jobId, `cache hit — workout ${existingWorkoutId}`);
        await db.from('processing_jobs').update({
          status: 'complete',
          source_video_id: cached.id,
          updated_at: new Date().toISOString(),
        }).eq('id', jobId);
        return;
      }

      // Source video exists but workout was deleted — recreate it from existing movements
      if (cachedTyped.movements?.length > 0) {
        log(jobId, `cache hit — recreating workout from ${cachedTyped.movements.length} existing movements`);
        const workoutId = crypto.randomUUID();
        await db.from('workouts').insert({
          id: workoutId,
          user_id: userId,
          title: cachedTyped.title,
          source_video_id: cachedTyped.id,
        });
        const workoutMovements = cachedTyped.movements
          .sort((a, b) => a.position - b.position)
          .map((m) => ({
            id: crypto.randomUUID(),
            workout_id: workoutId,
            movement_id: m.id,
            position: m.position,
          }));
        await db.from('workout_movements').insert(workoutMovements);
        await db.from('processing_jobs').update({
          status: 'complete',
          source_video_id: cachedTyped.id,
          updated_at: new Date().toISOString(),
        }).eq('id', jobId);
        return;
      }
    }
  }

  // 2. Download
  let videoPath = filePath;
  let videoTitle: string | null = null;

  if (!videoPath && url) {
    await updateJob(jobId, { status: 'downloading' });
    const result = await downloadVideo(url, tmpDir);
    if (result) {
      videoPath = result.path;
      log(jobId, 'download complete');
    } else {
      log(jobId, 'download failed');
      throw new Error('Could not download this video. Try saving it and uploading it directly instead.');
    }
  }

  // 3. Fetch video title
  if (!videoTitle && url) {
    videoTitle = await getVideoTitle(url);
  }

  // 4. Twelve Labs analysis
  await updateJob(jobId, { status: 'analyzing' });
  const detectionMethod = 'twelve_labs';
  if (!videoPath) throw new Error('Video could not be downloaded. Try uploading the file directly.');
  const segments: ParsedSegment[] = await analyzeWithTwelveLabs({ type: 'file', path: videoPath });

  log(jobId, `${segments.length} segments via ${detectionMethod}`);
  await updateJob(jobId, { segments_found: segments.length, detection_method_used: detectionMethod });

  // 5. Cut clips
  await updateJob(jobId, { status: 'cutting_clips' });
  const specs: ClipSpec[] = segments.map((s, i) => ({
    start_sec: s.start_sec,
    end_sec: s.end_sec,
    position: i,
  }));
  const clipsDir = path.join(tmpDir, 'clips');
  const { clipPaths, thumbPaths } = await cutClips(videoPath, specs, clipsDir);

  // 6. Upload + write DB rows
  await updateJob(jobId, { status: 'uploading' });

  const title = videoTitle ?? 'Workout';
  const sourceVideoId = crypto.randomUUID();

  const movementRows: MovementRow[] = [];
  let firstThumbUrl: string | null = null;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const storagePath = `${userId}/${sourceVideoId}/clip_${i}.mp4`;
    const thumbPath = `${userId}/${sourceVideoId}/thumb_${i}.jpg`;
    const [clipUrl, thumbnailUrl] = await Promise.all([
      uploadClip(clipPaths[i], storagePath),
      uploadClip(thumbPaths[i], thumbPath, 'image/jpeg'),
    ]);
    if (i === 0) firstThumbUrl = thumbnailUrl;
    movementRows.push({
      id: crypto.randomUUID(),
      source_video_id: sourceVideoId,
      position: i,
      name: seg.name,
      mode: seg.mode,
      start_sec: seg.start_sec,
      end_sec: seg.end_sec,
      duration_sec: seg.duration_sec,
      reps: seg.reps,
      sets: seg.sets,
      clip_url: clipUrl,
      thumbnail_url: thumbnailUrl,
      detection_method: detectionMethod,
      confidence: 0.8,
      is_rest: false,
      auto_generated: false,
    });
  }

  // Check if user cancelled while we were processing
  const { data: currentJob } = await db.from('processing_jobs').select('error').eq('id', jobId).single();
  if (currentJob?.error === '__cancelled__') {
    log(jobId, 'cancelled by user — skipping workout creation');
    return;
  }

  const sourceThumbUrl = (url ? getVideoThumbnailUrl(url) : null) ?? firstThumbUrl;
  const { data: svRow, error: svErr } = await db.from('source_videos').upsert({
    id: sourceVideoId,
    user_id: userId,
    original_url: url ?? null,
    platform,
    title,
    thumbnail_url: sourceThumbUrl,
    processing_status: 'complete',
    processed_at: new Date().toISOString(),
  }, { onConflict: 'original_url' }).select('id').single();
  if (svErr) throw new Error(svErr.message);

  // If a source_video already existed for this URL (e.g. a previous failed run),
  // the upsert updates it but keeps the original primary key — use that real ID.
  const actualSourceVideoId = svRow.id;
  const finalMovementRows = movementRows.map(m => ({ ...m, source_video_id: actualSourceVideoId }));

  const { error: movErr } = await db.from('movements').insert(finalMovementRows);
  if (movErr) throw new Error(movErr.message);

  const workoutId = crypto.randomUUID();
  const { error: wErr } = await db.from('workouts').insert({
    id: workoutId,
    user_id: userId,
    title,
    source_video_id: actualSourceVideoId,
  });
  if (wErr) throw new Error(wErr.message);

  const workoutMovements = finalMovementRows.map((m, i) => ({
    id: crypto.randomUUID(),
    workout_id: workoutId,
    movement_id: m.id,
    position: i,
  }));
  await db.from('workout_movements').insert(workoutMovements);

  await db.from('processing_jobs').update({
    status: 'complete',
    source_video_id: actualSourceVideoId,
    updated_at: new Date().toISOString(),
  }).eq('id', jobId);
}

import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { db } from '../db/client';
import { downloadVideo } from '../pipeline/download';
import { getVideoTitle, getVideoThumbnailUrl } from '../pipeline/chapters';
import { ParsedSegment, analyzeWithTwelveLabs } from '../pipeline/twelvelabs';
import { cutClips, ClipSpec } from '../pipeline/ffmpeg';
import { uploadClip } from '../pipeline/upload';

type JobStatus =
  | 'pending' | 'downloading' | 'analyzing' | 'cutting_clips' | 'uploading' | 'complete' | 'failed';

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
  platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'uploaded';
}) {
  const { jobId, userId, url, filePath, platform } = params;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tempo-'));

  try {
    log(jobId, `starting — platform: ${platform}, url: ${url ?? 'file upload'}`);

    // 1. Cache check
    if (url) {
      const { data: cached } = await db
        .from('source_videos')
        .select('id, title, workouts(id), movements(id, position, name, mode, start_sec, end_sec, duration_sec, reps, sets, clip_url, thumbnail_url, detection_method, confidence)')
        .eq('original_url', url)
        .eq('processing_status', 'complete')
        .single();

      if (cached) {
        const cachedTyped = cached as unknown as {
          id: string;
          title: string;
          workouts: Array<{ id: string }>;
          movements: Array<{ id: string; position: number; name: string; mode: string; start_sec: number; end_sec: number; duration_sec: number | null; reps: number | null; sets: number | null; clip_url: string; thumbnail_url: string | null; detection_method: string; confidence: number }>;
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
        throw new Error('Could not download this video. Try saving it to your camera roll and uploading it directly.');
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

    const movementRows: Array<{ id: string; source_video_id: string; position: number; name: string; mode: string; start_sec: number; end_sec: number; duration_sec: number | null; reps: number | null; sets: number | null; clip_url: string; thumbnail_url: string | null; detection_method: string; confidence: number }> = [];
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

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log(jobId, `FAILED: ${message}`);
    await updateJob(jobId, { status: 'failed', error: message });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

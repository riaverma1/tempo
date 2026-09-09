import { FastifyInstance } from 'fastify';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { db } from '../db/client';
import { processJob } from '../jobs/processJob';
import { detectPlatform, detectVideoPlatform } from '../pipeline/chapters';
import { detectFileKind } from '../pipeline/textInput';
import { Platform } from '../jobs/processJob';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// Tempo has no sign-in flow — one person, one account. Every request (iOS
// app and web app alike) is attributed to this fixed Supabase user id.
const OWNER_USER_ID = process.env.OWNER_USER_ID ?? '';

export async function processVideoRoute(app: FastifyInstance) {
  app.post('/process-video', async (request, reply) => {
    if (!OWNER_USER_ID) {
      return reply.status(500).send({ error: 'Server misconfigured: OWNER_USER_ID is not set' });
    }
    const userId = OWNER_USER_ID;

    let url: string | undefined;
    let filePath: string | undefined;
    let text: string | undefined;
    let platform: Platform;

    const contentType = request.headers['content-type'] ?? '';

    if (contentType.includes('multipart/form-data')) {
      // One picker, two content types — accepts a video file (existing
      // pipeline) or a PDF (new text pipeline); told apart by mime type.
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No file provided' });
      if (data.file.readableLength > MAX_FILE_SIZE) {
        return reply.status(413).send({ error: 'File exceeds 200MB limit' });
      }

      const kind = detectFileKind(data.mimetype, data.filename ?? '');
      if (kind === 'unknown') {
        return reply.status(400).send({ error: 'Unsupported file type — expected a video or a PDF' });
      }

      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tempo-upload-'));
      filePath = path.join(tmpDir, kind === 'pdf' ? 'upload.pdf' : 'video.mp4');
      await fs.writeFile(filePath, await data.toBuffer());
      platform = kind === 'pdf' ? 'pdf' : 'uploaded';
    } else {
      const body = request.body as { url?: string; text?: string };

      if (body.text) {
        text = body.text.trim();
        if (!text) return reply.status(400).send({ error: 'text is empty' });
        platform = 'text';
      } else {
        url = body.url;
        if (!url) return reply.status(400).send({ error: 'url or text is required' });
        const videoPlatform = detectVideoPlatform(url);
        if (!videoPlatform) {
          return reply.status(400).send({
            error: 'This link isn\'t a supported video platform (YouTube, TikTok, Instagram, or Facebook). For workout instructions from a webpage, save it as a PDF and upload that instead.',
          });
        }
        platform = videoPlatform;
      }
    }

    // Create job row
    const jobId = crypto.randomUUID();
    const { error: insertErr } = await db.from('processing_jobs').insert({
      id: jobId,
      user_id: userId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insertErr) {
      console.error(`[job:${jobId}] insert failed:`, insertErr.message, insertErr.code);
      return reply.status(500).send({ error: 'Failed to create job' });
    }

    // Kick off async (don't await)
    processJob({ jobId, userId, url, filePath, text, platform }).catch((err) => {
      console.error(`[job:${jobId}] unhandled error:`, err);
    });

    return reply.send({ job_id: jobId });
  });
}

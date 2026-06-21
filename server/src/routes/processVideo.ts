import { FastifyInstance } from 'fastify';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { db } from '../db/client';
import { processJob } from '../jobs/processJob';
import { detectPlatform } from '../pipeline/chapters';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

const DEV_BYPASS = process.env.DEV_BYPASS_AUTH === 'true';
const DEV_USER_ID = process.env.DEV_USER_ID ?? '';

export async function processVideoRoute(app: FastifyInstance) {
  app.post('/process-video', async (request, reply) => {
    let userId: string;

    if (DEV_BYPASS) {
      userId = DEV_USER_ID;
    } else {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const token = authHeader.slice(7);
      const { data: { user }, error: authErr } = await db.auth.getUser(token);
      if (authErr || !user) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      userId = user.id;
    }

    let url: string | undefined;
    let filePath: string | undefined;
    let platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'uploaded' = 'youtube';

    const contentType = request.headers['content-type'] ?? '';

    if (contentType.includes('multipart/form-data')) {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No file provided' });
      if (data.file.readableLength > MAX_FILE_SIZE) {
        return reply.status(413).send({ error: 'File exceeds 200MB limit' });
      }
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tempo-upload-'));
      filePath = path.join(tmpDir, 'video.mp4');
      await fs.writeFile(filePath, await data.toBuffer());
      platform = 'uploaded';
    } else {
      const body = request.body as { url?: string };
      url = body.url;
      if (!url) return reply.status(400).send({ error: 'url is required' });
      platform = detectPlatform(url);
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
    processJob({ jobId, userId, url, filePath, platform }).catch((err) => {
      console.error(`[job:${jobId}] unhandled error:`, err);
    });

    return reply.send({ job_id: jobId });
  });
}

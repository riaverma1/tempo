import 'dotenv/config';
import fs from 'fs/promises';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health';
import { processVideoRoute } from './routes/processVideo';

export const COOKIES_PATH = '/tmp/youtube_cookies.txt';

async function writeCookies() {
  const b64 = process.env.YOUTUBE_COOKIES_B64;
  if (!b64) return;
  await fs.writeFile(COOKIES_PATH, Buffer.from(b64, 'base64'));
  console.log('[startup] YouTube cookies written to', COOKIES_PATH);
}

async function main() {
  await writeCookies();
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } });

  await healthRoute(app);
  await processVideoRoute(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

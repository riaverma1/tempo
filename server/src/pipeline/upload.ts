import fs from 'fs';
import { db } from '../db/client';

export async function uploadClip(localPath: string, storagePath: string, contentType = 'video/mp4'): Promise<string> {
  const stat = fs.statSync(localPath);
  console.log(`[upload] ${storagePath} — ${(stat.size / 1024 / 1024).toFixed(1)} MB`);

  const fileBuffer = await fs.promises.readFile(localPath);
  const { error } = await db.storage
    .from('clips')
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = db.storage.from('clips').getPublicUrl(storagePath);
  console.log(`[upload] done — ${storagePath}`);
  return data.publicUrl;
}

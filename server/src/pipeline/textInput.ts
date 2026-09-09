import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import pdfParse from 'pdf-parse';

const execFileAsync = promisify(execFile);

// Below this many characters of extracted text, treat a PDF as scanned
// (image-only) rather than trusting its text layer.
const MIN_USABLE_TEXT_CHARS = 200;

export function detectFileKind(mimeType: string, filename: string): 'video' | 'pdf' | 'image' | 'unknown' {
  if (mimeType.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(filename)) return 'video';
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(filename)) return 'pdf';
  if (mimeType.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(filename)) return 'image';
  return 'unknown';
}

export async function extractPdfText(filePath: string): Promise<{ text: string; usable: boolean }> {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  const text = (data.text ?? '').trim();
  return { text, usable: text.length >= MIN_USABLE_TEXT_CHARS };
}

// Below this size, an embedded image is almost certainly a bullet/icon/logo
// rather than an exercise photo — pdfimages pulls out every embedded raster,
// decorative ones included.
const MIN_PHOTO_BYTES = 15_000;

// Pulls embedded exercise photos out of the PDF (via pdfimages, poppler-utils
// — same dependency as pdftoppm below), for use as movement thumbnails.
// Order matches where each image appears in the document, which for a sheet
// like hep2go's lines up with reading order — passed to interpretExercises
// so the model can match photo to exercise via image_index.
export async function extractPdfImages(filePath: string, outDir: string): Promise<string[]> {
  await fs.mkdir(outDir, { recursive: true });
  const prefix = path.join(outDir, 'img');
  await execFileAsync('pdfimages', ['-png', filePath, prefix]);
  const files = (await fs.readdir(outDir)).filter((f) => f.startsWith('img') && f.endsWith('.png')).sort();

  const withSizes = await Promise.all(
    files.map(async (f) => {
      const full = path.join(outDir, f);
      const { size } = await fs.stat(full);
      return { full, size };
    })
  );
  return withSizes.filter((f) => f.size >= MIN_PHOTO_BYTES).map((f) => f.full);
}

// Scanned/image-only PDFs have no usable text layer — render each page to a
// PNG instead, so the LLM call can read them visually. Shells out to
// pdftoppm (poppler-utils), the same pattern as the yt-dlp/ffmpeg calls
// elsewhere in this pipeline; install poppler-utils on the host to use it.
export async function renderPdfPagesToImages(filePath: string, outDir: string): Promise<string[]> {
  await fs.mkdir(outDir, { recursive: true });
  const prefix = path.join(outDir, 'page');
  await execFileAsync('pdftoppm', ['-png', '-r', '150', filePath, prefix]);
  const files = (await fs.readdir(outDir))
    .filter((f) => f.startsWith('page') && f.endsWith('.png'))
    .sort();
  return files.map((f) => path.join(outDir, f));
}

// A photo upload could be a JPEG, HEIC, WebP, or anything a phone produces —
// interpretExercises always sends images to Claude as image/png, so convert
// unconditionally rather than tracking media types through the rest of the
// pipeline. Uses ffmpeg, already a dependency for the video pipeline.
export async function normalizeImageToPng(filePath: string, outDir: string): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'photo.png');
  await execFileAsync('ffmpeg', ['-i', filePath, '-y', outPath]);
  return outPath;
}

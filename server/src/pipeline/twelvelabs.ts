import fs from 'fs';
export interface ParsedSegment {
  name: string;
  mode: 'timed' | 'reps';
  start_sec: number;
  end_sec: number;
  duration_sec: number | null;
  reps: number | null;
  sets: number | null;
}

const BASE = 'https://api.twelvelabs.io/v1.3';

async function getOrCreateIndex(): Promise<string> {
  const apiKey = process.env.TWELVE_LABS_API_KEY!;

  const res = await fetch(`${BASE}/indexes`, {
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify({
      index_name: 'tempo',
      models: [{ model_name: 'marengo3.0', model_options: ['visual', 'audio'] }],
    }),
  });

  if (res.status === 409) {
    const list = await fetch(`${BASE}/indexes?index_name=tempo`, {
      headers: { 'x-api-key': apiKey },
    });
    const data = await list.json() as { data: Array<{ _id: string }> };
    return data.data[0]._id;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Failed to create Twelve Labs index: ${res.status} — ${JSON.stringify(body)}`);
  }
  const data = await res.json() as { _id: string };
  return data._id;
}

async function uploadFile(indexId: string, videoPath: string): Promise<string> {
  const apiKey = process.env.TWELVE_LABS_API_KEY!;
  const fileBuffer = await fs.promises.readFile(videoPath);
  const blob = new Blob([fileBuffer], { type: 'video/mp4' });
  const form = new FormData();
  form.append('index_id', indexId);
  form.append('video_file', blob, 'video.mp4');

  const res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Twelve Labs upload failed: ${res.status} — ${JSON.stringify(body)}`);
  }
  const data = await res.json() as { _id: string };
  return data._id;
}

async function pollTask(taskId: string): Promise<string> {
  const apiKey = process.env.TWELVE_LABS_API_KEY!;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${BASE}/tasks/${taskId}`, {
      headers: { 'x-api-key': apiKey },
    });
    const data = await res.json() as { status: string; video_id?: string };
    if (data.status === 'ready' && data.video_id) return data.video_id;
    if (data.status === 'failed') throw new Error('Twelve Labs processing failed');
  }
  throw new Error('Twelve Labs timed out after 10 minutes');
}

async function analyzeForSegments(videoId: string): Promise<ParsedSegment[]> {
  const apiKey = process.env.TWELVE_LABS_API_KEY!;

  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_name: 'pegasus1.5',
      video: { type: 'asset_id', asset_id: videoId },
      prompt_v2: {
        input_text: 'List all distinct exercise movements or workout segments in this video. For each, provide the name, start time, and end time in seconds.',
      },
      response_format: {
        type: 'json_schema',
        json_schema: {
          properties: {
            segments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  start: { type: 'number' },
                  end: { type: 'number' },
                },
                required: ['name', 'start', 'end'],
              },
            },
          },
          required: ['segments'],
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Twelve Labs analyze failed: ${res.status} — ${JSON.stringify(body)}`);
  }

  const rawText = await res.text();

  // Response is streaming NDJSON — concatenate all text_generation chunks
  const lines = rawText.split('\n').filter(Boolean);
  let assembled = '';
  for (const line of lines) {
    try {
      const event = JSON.parse(line) as { event_type: string; text?: string };
      if (event.event_type === 'text_generation' && event.text) {
        assembled += event.text;
      }
    } catch { /* skip malformed lines */ }
  }

  console.log(`[twelvelabs] assembled response: ${assembled.slice(0, 300)}`);

  let segments: Array<{ name: string; start: number; end: number }> = [];
  try {
    const parsed = JSON.parse(assembled);
    segments = parsed.segments ?? [];
  } catch {
    throw new Error(`Twelve Labs response unparseable: ${assembled.slice(0, 200)}`);
  }

  return segments.map((s) => ({
    name: s.name,
    mode: 'timed' as const,
    start_sec: Math.floor(s.start),
    end_sec: Math.ceil(s.end),
    duration_sec: Math.ceil(s.end) - Math.floor(s.start),
    reps: null,
    sets: null,
  }));
}

export async function analyzeWithTwelveLabs(
  source: { type: 'file'; path: string } | { type: 'url'; url: string }
): Promise<ParsedSegment[]> {
  if (source.type === 'url') {
    throw new Error('Twelve Labs fallback requires a downloaded file — URL-only analysis not supported in v1.3');
  }

  const indexId = await getOrCreateIndex();
  const taskId = await uploadFile(indexId, source.path);
  const videoId = await pollTask(taskId);
  return analyzeForSegments(videoId);
}

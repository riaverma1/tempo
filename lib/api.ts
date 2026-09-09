const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export async function processVideo(payload: { url: string } | { text: string } | FormData): Promise<{ job_id: string }> {
  const isFormData = payload instanceof FormData;
  const res = await fetch(`${BASE_URL}/process-video`, {
    method: 'POST',
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    body: isFormData ? payload : JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Failed to start processing');
  }
  return res.json();
}

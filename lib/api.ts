import { supabase } from '@/lib/supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const BYPASS_AUTH = process.env.EXPO_PUBLIC_USE_MOCK === 'true' || process.env.EXPO_PUBLIC_BYPASS_AUTH === 'true';

async function authHeaders(): Promise<Record<string, string>> {
  if (BYPASS_AUTH) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

export async function processVideo(payload: { url: string } | FormData): Promise<{ job_id: string }> {
  const isFormData = payload instanceof FormData;
  const auth = await authHeaders();
  const res = await fetch(`${BASE_URL}/process-video`, {
    method: 'POST',
    headers: {
      ...auth,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isFormData ? payload : JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Failed to start processing');
  }
  return res.json();
}

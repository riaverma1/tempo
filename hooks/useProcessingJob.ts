import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ProcessingJob } from '@/types';

async function resolveWorkoutId(sourceVideoId: string): Promise<string | null> {
  const { data } = await supabase
    .from('workouts')
    .select('id')
    .eq('source_video_id', sourceVideoId)
    .single();
  return data?.id ?? null;
}

async function checkJob(jobId: string): Promise<ProcessingJob | null> {
  const { data } = await supabase
    .from('processing_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  return data as ProcessingJob | null;
}

export function useProcessingJob(jobId: string | null) {
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const resolvedRef = useRef(false);

  const handleComplete = async (sourceVideoId: string) => {
    if (resolvedRef.current) return;
    const id = await resolveWorkoutId(sourceVideoId);
    if (id) {
      resolvedRef.current = true;
      setWorkoutId(id);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    // Poll every 2 seconds as primary mechanism
    const poll = async () => {
      const data = await checkJob(jobId);
      if (!data) return;
      setJob(data);
      if (data.status === 'complete' && data.source_video_id) {
        await handleComplete(data.source_video_id);
      }
    };

    poll(); // immediate first check
    const interval = setInterval(poll, 2000);

    // Realtime as a secondary faster signal
    const channel = supabase
      .channel(`job:${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'processing_jobs', filter: `id=eq.${jobId}` },
        async (payload) => {
          const updated = payload.new as ProcessingJob;
          setJob(updated);
          if (updated.status === 'complete' && updated.source_video_id) {
            await handleComplete(updated.source_video_id);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return { job, workoutId };
}

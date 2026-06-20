import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Workout } from '@/types';
import { MOCK_WORKOUT } from '@/mocks/workout';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export function useWorkout(workoutId: string | null) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workoutId) {
      setLoading(false);
      return;
    }

    if (USE_MOCK) {
      setWorkout(MOCK_WORKOUT);
      setLoading(false);
      return;
    }

    supabase
      .from('workouts')
      .select(`
        *,
        source_video:source_videos(*),
        movements:workout_movements(
          *,
          movement:movements(*)
        )
      `)
      .eq('id', workoutId)
      .order('position', { referencedTable: 'workout_movements' })
      .single()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setWorkout(data as Workout);
        }
        setLoading(false);
      });
  }, [workoutId]);

  return { workout, loading, error };
}

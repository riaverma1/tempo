import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tempo:beep_count';
const DEFAULT_BEEP_COUNT = 3;
export const BEEP_COUNT_OPTIONS = [0, 1, 2, 3] as const;

// How many beeps count down before a timed movement ends (one per second,
// e.g. 3 beeps at 3-2-1). Persisted so the choice carries across workouts,
// same storage on iOS and web since both run this same code.
export function useBeepCount() {
  const [beepCount, setBeepCount] = useState(DEFAULT_BEEP_COUNT);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored != null) setBeepCount(Number(stored));
    });
  }, []);

  const cycleBeepCount = () => {
    setBeepCount((prev) => {
      const currentIndex = BEEP_COUNT_OPTIONS.indexOf(prev as typeof BEEP_COUNT_OPTIONS[number]);
      const next = BEEP_COUNT_OPTIONS[(currentIndex + 1) % BEEP_COUNT_OPTIONS.length];
      AsyncStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return { beepCount, cycleBeepCount };
}

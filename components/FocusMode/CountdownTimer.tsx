import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  durationSec: number;
  onComplete?: () => void;
  onBeep?: () => void;
  running: boolean;
  beepCount?: number;
}

export function CountdownTimer({ durationSec, onComplete, onBeep, running, beepCount = 3 }: Props) {
  const [remaining, setRemaining] = useState(durationSec);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onBeepRef = useRef(onBeep);
  const beepCountRef = useRef(beepCount);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onBeepRef.current = onBeep; }, [onBeep]);
  useEffect(() => { beepCountRef.current = beepCount; }, [beepCount]);

  useEffect(() => {
    setRemaining(durationSec);
  }, [durationSec]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;

        if (next <= beepCountRef.current && next > 0) {
          setTimeout(() => onBeepRef.current?.(), 0);
        }

        if (next <= 0) {
          clearInterval(intervalRef.current!);
          setTimeout(() => onCompleteRef.current?.(), 0);
          return 0;
        }

        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}`;

  return (
    <View style={styles.container}>
      <Text style={styles.timer}>{display}</Text>
      <Text style={styles.label}>seconds</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  timer: {
    fontSize: 96,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: -4,
    lineHeight: 96,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});

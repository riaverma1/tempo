import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { WorkoutMovement } from '@/types';

interface Props {
  next: WorkoutMovement | null;
}

export function UpNextStrip({ next }: Props) {
  if (!next) return null;

  const detail =
    next.movement.mode === 'timed'
      ? `${next.movement.duration_sec}s`
      : `${next.movement.sets} × ${next.movement.reps}`;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>UP NEXT</Text>
      <Text style={styles.name}>{next.movement.name}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceAlt,
    marginHorizontal: 24,
    borderRadius: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  detail: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});

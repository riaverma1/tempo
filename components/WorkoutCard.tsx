import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { Workout } from '@/types';

interface Props {
  workout: Workout;
  onPress: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function WorkoutCard({ workout, onPress, onEdit, onRemove }: Props) {
  const movementCount = workout.movements?.length ?? 0;
  const thumb = workout.source_video?.thumbnail_url;
  const date = new Date(workout.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const totalSec = workout.movements?.reduce((sum, wm) => {
    return sum + (wm.movement?.duration_sec ?? 0);
  }, 0) ?? 0;
  const durationStr = totalSec > 0 ? formatDuration(totalSec) : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.thumb}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{workout.title}</Text>
        <Text style={styles.meta}>{movementCount} movements{durationStr ? ` · ${durationStr}` : ''} · {date}</Text>
      </View>
      <View style={styles.actions}>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn} hitSlop={8}>
            <Text style={styles.editIcon}>✎</Text>
          </TouchableOpacity>
        )}
        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.actionBtn} hitSlop={8}>
            <Text style={styles.removeIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
  },
  thumbPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 6,
  },
  editIcon: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  removeIcon: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { Workout } from '@/types';

interface Props {
  workout: Workout;
  onPress: () => void;
  onRemove?: () => void;
}

export function WorkoutCard({ workout, onPress, onRemove }: Props) {
  const movementCount = workout.movements?.length ?? 0;
  const thumb = workout.source_video?.thumbnail_url;
  const date = new Date(workout.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

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
        <Text style={styles.meta}>{movementCount} movements · {date}</Text>
      </View>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
          <Text style={styles.removeIcon}>✕</Text>
        </TouchableOpacity>
      )}
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
  removeBtn: {
    padding: 8,
  },
  removeIcon: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});

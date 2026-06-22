import React, { useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { FocusModePlayer } from '@/components/FocusMode/FocusModePlayer';
import { useWorkout } from '@/hooks/useWorkout';
import { WorkoutMovement } from '@/types';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout, loading, error } = useWorkout(id);
  const router = useRouter();
  const [started, setStarted] = useState(false);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (error || !workout) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Workout not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const movements = workout.movements ?? [];
  const thumbnail = workout.source_video?.thumbnail_url ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{workout.title}</Text>
        {!started ? (
          <TouchableOpacity onPress={() => router.push(`/workout/review/${id}`)}>
            <Text style={styles.editBtn}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      {!started ? (
        <View style={styles.cover}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.thumbWrap}>
              {thumbnail ? (
                <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={styles.thumbPlaceholder} />
              )}
              <View style={styles.overlay} />
            </View>
            <View style={styles.coverMeta}>
              <Text style={styles.coverTitle}>{workout.title}</Text>
              <Text style={styles.coverSub}>{movements.length} movements</Text>
            </View>
            <View style={styles.movementList}>
              <Text style={styles.sectionLabel}>Movements</Text>
              {movements.map((wm: WorkoutMovement, i: number) => {
                const m = wm.movement;
                const detail = m.mode === 'timed' && m.duration_sec
                  ? `${m.duration_sec}s`
                  : m.reps && m.sets
                  ? `${m.sets}×${m.reps}`
                  : m.reps
                  ? `${m.reps} reps`
                  : null;
                return (
                  <View key={wm.id} style={styles.movementRow}>
                    <Text style={styles.movementNum}>{i + 1}</Text>
                    {m.thumbnail_url ? (
                      <Image source={{ uri: m.thumbnail_url }} style={styles.movementThumb} />
                    ) : (
                      <View style={[styles.movementThumb, styles.movementThumbPlaceholder]} />
                    )}
                    <Text style={styles.movementName} numberOfLines={2}>{m.name}</Text>
                    {detail && <Text style={styles.movementDetail}>{detail}</Text>}
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.startBar}>
            <TouchableOpacity style={styles.startBtn} onPress={() => setStarted(true)} activeOpacity={0.85}>
              <Text style={styles.startBtnText}>Start</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FocusModePlayer
          movements={movements}
          onFinish={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  close: {
    color: Colors.textSecondary,
    fontSize: 18,
    width: 28,
  },
  editBtn: {
    color: Colors.textSecondary,
    fontSize: 15,
    width: 28,
    textAlign: 'right',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  cover: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.surface,
  },
  thumbPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surfaceAlt,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  coverMeta: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 4,
    gap: 4,
  },
  coverTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  coverSub: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  movementList: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 2,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  movementNum: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    width: 20,
    textAlign: 'right',
  },
  movementThumb: {
    width: 52,
    height: 52,
    borderRadius: 6,
  },
  movementThumbPlaceholder: {
    backgroundColor: Colors.surfaceAlt,
  },
  movementName: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  movementDetail: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  startBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  startBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 15,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backText: {
    color: Colors.text,
    fontSize: 15,
  },
});

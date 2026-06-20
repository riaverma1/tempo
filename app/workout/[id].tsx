import React, { useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { FocusModePlayer } from '@/components/FocusMode/FocusModePlayer';
import { useWorkout } from '@/hooks/useWorkout';

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
        <View style={{ width: 28 }} />
      </View>

      {!started ? (
        <View style={styles.cover}>
          <View style={styles.thumbWrap}>
            {thumbnail ? (
              <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.thumbPlaceholder} />
            )}
            <View style={styles.overlay} />
            <TouchableOpacity style={styles.playBtn} onPress={() => setStarted(true)} activeOpacity={0.85}>
              <Text style={styles.playIcon}>▶</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.coverMeta}>
            <Text style={styles.coverTitle}>{workout.title}</Text>
            <Text style={styles.coverSub}>{movements.length} movements</Text>
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
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surfaceAlt,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: '#000',
    fontSize: 28,
    marginLeft: 4,
  },
  coverMeta: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 6,
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

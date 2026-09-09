import React, { useCallback, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { WorkoutCard } from '@/components/WorkoutCard';
import { supabase } from '@/lib/supabase';
import { confirm } from '@/lib/confirm';
import { OWNER_USER_ID } from '@/lib/env';
import { Workout } from '@/types';

export default function Library() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchWorkouts = useCallback(async () => {
    if (!OWNER_USER_ID) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('workouts')
      .select('*, source_video:source_videos(*), movements:workout_movements(id, movement:movements(duration_sec))')
      .eq('user_id', OWNER_USER_ID)
      .order('created_at', { ascending: false });

    if (error) console.error('[library] fetch error:', error.message);
    if (data) setWorkouts(data as Workout[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    fetchWorkouts();
  }, [fetchWorkouts]));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
      </View>
      {!loading && workouts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No workouts yet.</Text>
          <Text style={styles.emptyHint}>Add your first workout from the Add tab.</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <WorkoutCard
              workout={item}
              onPress={() => router.push(`/workout/${item.id}`)}
              onEdit={() => router.push(`/workout/review/${item.id}`)}
              onRemove={() =>
                confirm('Delete workout?', `"${item.title}" will be permanently removed.`, 'Delete', async () => {
                  setWorkouts((prev) => prev.filter((w) => w.id !== item.id));
                  await supabase.from('workout_movements').delete().eq('workout_id', item.id);
                  await supabase.from('workouts').delete().eq('id', item.id);
                })
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
  },
  list: {
    padding: 24,
    paddingTop: 8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});

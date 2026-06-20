import React, { useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ProcessingStatusView } from '@/components/ProcessingStatus';
import { useProcessingJob } from '@/hooks/useProcessingJob';

export default function ProcessingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, workoutId } = useProcessingJob(id);
  const router = useRouter();

  useEffect(() => {
    if (workoutId) {
      router.replace(`/workout/review/${workoutId}`);
    }
  }, [workoutId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
      {job ? (
        <ProcessingStatusView job={job} />
      ) : (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Starting…</Text>
        </View>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancel: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
});

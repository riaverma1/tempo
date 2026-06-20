import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { VideoInput } from '@/components/VideoInput';
import { processVideo } from '@/lib/api';

export default function AddWorkout() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const startProcessing = async (jobId: string) => {
    router.push(`/workout/processing/${jobId}`);
  };

  const handleUrl = async (url: string) => {
    try {
      setLoading(true);
      const { job_id } = await processVideo({ url });
      await startProcessing(job_id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (uri: string, mimeType: string) => {
    try {
      setLoading(true);
      const form = new FormData();
      // @ts-expect-error RN FormData accepts uri objects
      form.append('file', { uri, type: mimeType, name: 'video.mp4' });
      const { job_id } = await processVideo(form);
      await startProcessing(job_id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add Workout</Text>
        <Text style={styles.sub}>Paste a YouTube link or import a TikTok from your camera roll.</Text>
        <VideoInput onSubmitUrl={handleUrl} onSubmitFile={handleFile} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    padding: 24,
    gap: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
  },
  sub: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: -8,
  },
});

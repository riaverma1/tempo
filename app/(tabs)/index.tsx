import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { VideoInput } from '@/components/VideoInput';
import { processVideo } from '@/lib/api';
import { notify } from '@/lib/confirm';

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
      notify('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (uri: string, mimeType: string, filename: string) => {
    try {
      setLoading(true);
      const form = new FormData();
      // @ts-expect-error RN FormData accepts uri objects
      form.append('file', { uri, type: mimeType, name: filename });
      const { job_id } = await processVideo(form);
      await startProcessing(job_id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      notify('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleText = async (text: string) => {
    try {
      setLoading(true);
      const { job_id } = await processVideo({ text });
      await startProcessing(job_id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      notify('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add Workout</Text>
        <Text style={styles.sub}>
          Paste a video link, type in the instructions, or upload a video, PDF, or photo.
        </Text>
        <VideoInput
          onSubmitUrl={handleUrl}
          onSubmitFile={handleFile}
          onSubmitText={handleText}
          loading={loading}
        />
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

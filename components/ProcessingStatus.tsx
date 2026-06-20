import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { ProcessingJob, ProcessingStatus as Status } from '@/types';

const STEPS: { status: Status; label: string }[] = [
  { status: 'downloading', label: 'Downloading video' },
  { status: 'analyzing', label: 'Analyzing with AI' },
  { status: 'cutting_clips', label: 'Cutting clips' },
  { status: 'uploading', label: 'Uploading' },
];

const STATUS_ORDER = STEPS.map((s) => s.status);

function statusIndex(s: Status): number {
  return STATUS_ORDER.indexOf(s);
}

interface Props {
  job: ProcessingJob;
}

export function ProcessingStatusView({ job }: Props) {
  const currentIdx = statusIndex(job.status);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <Text style={styles.title}>Processing your workout</Text>
        {job.segments_found != null && (
          <Text style={styles.found}>{job.segments_found} movements found</Text>
        )}
      </View>

      <View style={styles.steps}>
        {STEPS.map((step, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          return (
            <View key={step.status} style={styles.step}>
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]} />
              <Text style={[styles.stepLabel, done && styles.stepDone, active && styles.stepActive]}>
                {step.label}
              </Text>
              {active && <ActivityIndicator color={Colors.accent} size="small" style={styles.spinner} />}
            </View>
          );
        })}
      </View>

      {job.status === 'failed' && (
        <View style={styles.error}>
          <Text style={styles.errorText}>{job.error ?? 'Processing failed. Please try again.'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 32,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 48,
    marginTop: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  found: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600',
  },
  steps: {
    gap: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  dotDone: {
    backgroundColor: Colors.success,
  },
  dotActive: {
    backgroundColor: Colors.accent,
  },
  stepLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.textMuted,
  },
  stepDone: {
    color: Colors.textSecondary,
  },
  stepActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 4,
  },
  error: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#2D1515',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
});

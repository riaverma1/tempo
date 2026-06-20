import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  sets: number;
  reps: number;
}

export function RepsDisplay({ sets, reps }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.display}>
        {sets} <Text style={styles.x}>×</Text> {reps}
      </Text>
      <Text style={styles.label}>sets × reps</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  display: {
    fontSize: 88,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: -2,
    lineHeight: 96,
  },
  x: {
    color: Colors.accentDim,
    fontSize: 64,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});

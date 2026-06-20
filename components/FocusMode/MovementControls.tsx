import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  isLast: boolean;
}

export function MovementControls({ onPrev, onNext, hasPrev, hasNext, isLast }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.secondaryBtn, !hasPrev && styles.disabled]}
        onPress={onPrev}
        disabled={!hasPrev}
      >
        <Text style={[styles.secondaryText, !hasPrev && styles.disabledText]}>← Prev</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
        <Text style={styles.nextText}>{isLast ? 'Finish' : 'Next →'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
  },
  secondaryBtn: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 2,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.3,
  },
  disabledText: {
    color: Colors.textMuted,
  },
});

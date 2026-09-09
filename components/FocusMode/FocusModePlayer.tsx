import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { Colors } from '@/constants/colors';
import { WorkoutMovement } from '@/types';
import { CountdownTimer } from './CountdownTimer';
import { RepsDisplay } from './RepsDisplay';
import { MovementControls } from './MovementControls';
import { UpNextStrip } from './UpNextStrip';

interface Props {
  movements: WorkoutMovement[];
  onFinish: () => void;
}

export function FocusModePlayer({ movements, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const { width } = useWindowDimensions();
  const beepRef = useRef<Audio.Sound | null>(null);

  // Configure audio session to mix with background music
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
    });

    Audio.Sound.createAsync(require('@/assets/beep.mp3')).then(({ sound }) => {
      beepRef.current = sound;
    });

    return () => {
      beepRef.current?.unloadAsync();
    };
  }, []);

  const playBeep = async () => {
    try {
      if (beepRef.current) {
        await beepRef.current.setPositionAsync(0);
        await beepRef.current.playAsync();
      }
    } catch { /* ignore */ }
  };

  if (!movements || movements.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textSecondary, fontSize: 15 }}>No movements found</Text>
      </View>
    );
  }

  const current = movements[index];
  const next = movements[index + 1] ?? null;
  const m = current.movement;

  const player = useVideoPlayer(m.clip_url || null, (p) => {
    p.loop = true;
    p.muted = muted;
    p.audioMixingMode = 'mixWithOthers';
    if (m.clip_url) p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [paused]);

  const handleNext = () => {
    setPaused(false);
    if (index >= movements.length - 1) {
      onFinish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (index > 0) {
      setPaused(false);
      setIndex((i) => i - 1);
    }
  };

  return (
    <View style={styles.container}>
      {/* Exercise name + mute toggle */}
      <View style={styles.nameContainer}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.position}>{index + 1} / {movements.length}</Text>
            <Text style={styles.name} numberOfLines={2}>{m.name}</Text>
          </View>
          <TouchableOpacity onPress={() => setPaused((v) => !v)} style={styles.muteBtn}>
            <Text style={styles.muteIcon}>{paused ? '▶️' : '⏸️'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMuted((v) => !v)} style={styles.muteBtn}>
            <Text style={styles.muteIcon}>{muted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Video clip */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setPaused((v) => !v)}
        style={[styles.videoContainer, { width, height: width * 0.75 }]}
      >
        {m.clip_url ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>No clip</Text>
          </View>
        )}
        {paused && (
          <View style={styles.pauseOverlay}>
            <Text style={styles.pauseIcon}>▶</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Timer or reps */}
      <View style={styles.displayContainer}>
        {m.mode === 'timed' && m.duration_sec ? (
          <CountdownTimer
            key={index}
            durationSec={m.duration_sec}
            running={!paused}
            onComplete={handleNext}
            onBeep={playBeep}
          />
        ) : (
          <RepsDisplay sets={m.sets ?? 0} reps={m.reps ?? 0} />
        )}
      </View>

      {/* Up next */}
      <UpNextStrip next={next} />

      {/* Controls */}
      <View style={styles.controls}>
        <MovementControls
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={index > 0}
          hasNext={index < movements.length - 1}
          isLast={index === movements.length - 1}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  nameContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  position: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  name: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  muteBtn: {
    padding: 8,
    marginTop: 4,
  },
  muteIcon: {
    fontSize: 22,
  },
  videoContainer: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: {
    color: '#fff',
    fontSize: 40,
  },
  displayContainer: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  controls: {
    paddingTop: 16,
    paddingBottom: 32,
  },
});

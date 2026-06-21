import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';

interface Props {
  onSubmitUrl: (url: string) => void;
  onSubmitFile: (uri: string, mimeType: string) => void;
  loading: boolean;
}

export function VideoInput({ onSubmitUrl, onSubmitFile, loading }: Props) {
  const [url, setUrl] = useState('');

  const handleSubmitUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSubmitUrl(trimmed);
  };

  const handlePickFile = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    onSubmitFile(asset.uri, asset.mimeType ?? 'video/mp4');
  };

  return (
    <View style={styles.container}>
      <View style={styles.urlRow}>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="Paste YouTube, TikTok, or Instagram URL"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleSubmitUrl}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.goBtn, (!url.trim() || loading) && styles.goBtnDisabled]}
          onPress={handleSubmitUrl}
          disabled={!url.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.goBtnText}>→</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity style={styles.fileBtn} onPress={handlePickFile} disabled={loading}>
        <Text style={styles.fileBtnText}>Import video from Camera Roll</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  urlRow: {
    position: 'relative',
  },
  input: {
    height: 52,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingRight: 56,
    color: Colors.text,
    fontSize: 15,
  },
  goBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBtnDisabled: {
    opacity: 0.4,
  },
  goBtnText: {
    color: Colors.background,
    fontWeight: '800',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  or: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  fileBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});

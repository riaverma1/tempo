import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '@/constants/colors';

interface Props {
  onSubmitUrl: (url: string) => void;
  onSubmitFile: (uri: string, mimeType: string, filename: string) => void;
  onSubmitText: (text: string) => void;
  loading: boolean;
}

export function VideoInput({ onSubmitUrl, onSubmitFile, onSubmitText, loading }: Props) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');

  const handleSubmitUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSubmitUrl(trimmed);
  };

  const handleSubmitText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmitText(trimmed);
  };

  const handlePickFile = async () => {
    // One picker, either a video or a PDF — the server tells them apart by
    // mime type and routes to the video pipeline or the text pipeline.
    const result = await DocumentPicker.getDocumentAsync({
      type: ['video/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    onSubmitFile(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Link</Text>
      <View style={styles.urlRow}>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="YouTube, TikTok, Instagram, or Facebook link"
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

      <Text style={styles.label}>Type it in</Text>
      <TextInput
        style={styles.textarea}
        value={text}
        onChangeText={setText}
        placeholder={'e.g. "Bridges — hold 6 seconds, repeat 6 times, 3 sets"'}
        placeholderTextColor={Colors.textMuted}
        multiline
        numberOfLines={4}
        editable={!loading}
      />
      <TouchableOpacity
        style={[styles.textSubmitBtn, (!text.trim() || loading) && styles.goBtnDisabled]}
        onPress={handleSubmitText}
        disabled={!text.trim() || loading}
      >
        <Text style={styles.textSubmitBtnText}>{loading ? 'Working…' : 'Build workout from text'}</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity style={styles.fileBtn} onPress={handlePickFile} disabled={loading}>
        <Text style={styles.fileBtnText}>Upload a video or PDF</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: -4,
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
  textarea: {
    minHeight: 96,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  textSubmitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSubmitBtnText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
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

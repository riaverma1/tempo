import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { WorkoutMovement } from '@/types';

interface ReviewMovement extends WorkoutMovement {
  _key: string; // stable key even after duplicating
}

interface EditTarget {
  type: 'title' | 'movement-name' | 'movement-duration' | 'all-durations';
  key: string;
  movementId?: string;
  current: string;
}

export default function ReviewScreen() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [movements, setMovements] = useState<ReviewMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase
      .from('workouts')
      .select(`
        title,
        movements:workout_movements(
          *,
          movement:movements(*)
        )
      `)
      .eq('id', id)
      .order('position', { referencedTable: 'workout_movements' })
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        setTitle(data.title);
        setMovements(
          (data.movements ?? []).map((m: WorkoutMovement) => ({ ...m, _key: m.id }))
        );
        setLoading(false);
      });
  }, [id]);

  const openEdit = (target: EditTarget) => {
    setEditTarget(target);
    setEditValue(target.current);
  };

  const commitEdit = () => {
    if (!editTarget) return;
    const val = editValue.trim();
    if (!val) { setEditTarget(null); return; }

    if (editTarget.type === 'title') {
      setTitle(val);
    } else if (editTarget.type === 'movement-name') {
      setMovements((prev) =>
        prev.map((m) =>
          m._key === editTarget.key
            ? { ...m, movement: { ...m.movement, name: val } }
            : m
        )
      );
    } else if (editTarget.type === 'movement-duration') {
      const secs = Math.max(1, parseInt(val, 10) || 0);
      setMovements((prev) =>
        prev.map((m) =>
          m._key === editTarget.key
            ? { ...m, movement: { ...m.movement, duration_sec: secs } }
            : m
        )
      );
    } else if (editTarget.type === 'all-durations') {
      const secs = Math.max(1, parseInt(val, 10) || 0);
      setMovements((prev) =>
        prev.map((m) => ({ ...m, movement: { ...m.movement, duration_sec: secs } }))
      );
    }
    setEditTarget(null);
  };

  const duplicate = (key: string) => {
    setMovements((prev) => {
      const idx = prev.findIndex((m) => m._key === key);
      if (idx === -1) return prev;
      const original = prev[idx];
      const copy: ReviewMovement = {
        ...original,
        _key: `${original._key}_copy_${Date.now()}`,
        id: `new_${Date.now()}`,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const deleteMovement = (key: string) => {
    const m = movements.find((m) => m._key === key);
    Alert.alert('Remove movement?', m?.movement.name ?? '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setMovements((prev) => prev.filter((m) => m._key !== key)),
      },
    ]);
  };

  const deleteWorkoutRow = async () => {
    if (!id) return;
    await supabase.from('workout_movements').delete().eq('workout_id', id);
    await supabase.from('workouts').delete().eq('id', id);
    router.replace('/(tabs)/library');
  };

  const discardAndLeave = () => {
    if (isNew === 'true') {
      Alert.alert('Discard workout?', 'This workout will not be saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: deleteWorkoutRow },
      ]);
    } else {
      router.back();
    }
  };

  const deleteWorkout = () => {
    Alert.alert('Delete workout?', `"${title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteWorkoutRow },
    ]);
  };

  const saveEdits = async () => {
    if (!id) return;
    await supabase.from('workouts').update({ title }).eq('id', id);

    // Delete any removed workout_movements (only ones with real DB ids)
    const activeIds = new Set(movements.filter((m) => !m.id.startsWith('new_')).map((m) => m.id));
    const { data: existing } = await supabase.from('workout_movements').select('id').eq('workout_id', id);
    const toDelete = (existing ?? []).filter((r) => !activeIds.has(r.id)).map((r) => r.id);
    if (toDelete.length > 0) await supabase.from('workout_movements').delete().in('id', toDelete);

    // Update or insert each movement row
    for (let i = 0; i < movements.length; i++) {
      const m = movements[i];
      await supabase.from('movements').update({
        name: m.movement.name,
        duration_sec: m.movement.duration_sec,
      }).eq('id', m.movement.id);

      if (m.id.startsWith('new_')) {
        await supabase.from('workout_movements').insert({
          workout_id: id,
          movement_id: m.movement.id,
          position: i,
        });
      } else {
        await supabase.from('workout_movements').update({ position: i }).eq('id', m.id);
      }
    }
  };

  const saveAndGoTo = async (destination: Href) => {
    setSaving(true);
    try {
      await saveEdits();
      router.replace(destination);
    } catch {
      Alert.alert('Save failed', 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveToLibrary = () => { saveAndGoTo('/(tabs)/library'); };
  const save = () => { if (id) saveAndGoTo(`/workout/${id}`); };

  const renderItem = ({ item: m, drag, isActive }: RenderItemParams<ReviewMovement>) => (
    <ScaleDecorator>
      <View style={[styles.card, isActive && styles.cardActive]}>
        {m.movement.thumbnail_url ? (
          <Image source={{ uri: m.movement.thumbnail_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <View style={styles.cardBody}>
          <TouchableOpacity
            onPress={() =>
              openEdit({ type: 'movement-name', key: m._key, movementId: m.movement.id, current: m.movement.name })
            }
          >
            <Text style={styles.movementName}>{m.movement.name}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              openEdit({ type: 'movement-duration', key: m._key, movementId: m.movement.id, current: String(m.movement.duration_sec ?? '') })
            }
          >
            <Text style={styles.movementDuration}>
              {m.movement.duration_sec != null ? `${m.movement.duration_sec}s` : '—'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => duplicate(m._key)} style={styles.actionBtn}>
            <Text style={styles.actionIcon}>⧉</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteMovement(m._key)} style={styles.actionBtn}>
            <Text style={[styles.actionIcon, styles.deleteIcon]}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity onLongPress={drag} delayLongPress={150} style={styles.actionBtn}>
            <Text style={styles.dragHandle}>⠿</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScaleDecorator>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={discardAndLeave}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Workout</Text>
          <TouchableOpacity onPress={saveToLibrary} disabled={saving}>
            <Text style={[styles.saveBtn, saving && styles.saveBtnDim]}>{saving ? '…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        {/* Workout title */}
        <TouchableOpacity
          style={styles.titleRow}
          onPress={() => openEdit({ type: 'title', key: 'title', current: title })}
        >
          <Text style={styles.workoutTitle}>{title}</Text>
          <Text style={styles.editHint}>tap to rename</Text>
        </TouchableOpacity>

        <View style={styles.sectionRow}>
          <View style={styles.sectionMeta}>
            <Text style={styles.sectionLabel}>{movements.length} movements</Text>
            <Text style={styles.sectionHint}>Hold ⠿ to reorder</Text>
          </View>
          <TouchableOpacity
            onPress={() => openEdit({ type: 'all-durations', key: 'all', current: '' })}
            style={styles.setAllBtnWrap}
          >
            <Text style={styles.setAllBtn}>Set all durations</Text>
          </TouchableOpacity>
        </View>

        <DraggableFlatList
          data={movements}
          keyExtractor={(m) => m._key}
          onDragEnd={({ data }) => setMovements(data)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <View>
              <View style={styles.footerBtns}>
                <TouchableOpacity style={styles.footerBtnSecondary} onPress={saveToLibrary} disabled={saving}>
                  <Text style={styles.footerBtnSecondaryText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerBtnPrimary} onPress={save} disabled={saving}>
                  <Text style={styles.footerBtnPrimaryText}>{saving ? 'Saving…' : 'Start'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.deleteWorkoutBtn} onPress={deleteWorkout}>
                <Text style={styles.deleteWorkoutText}>Delete Workout</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Inline edit modal */}
        <Modal visible={!!editTarget} transparent animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditTarget(null)} />
            <View style={styles.modalCard}>
              <Text style={styles.modalLabel}>
                {editTarget?.type === 'title'
                  ? 'Workout name'
                  : editTarget?.type === 'movement-name'
                  ? 'Movement name'
                  : editTarget?.type === 'all-durations'
                  ? 'Set all durations (seconds)'
                  : 'Duration (seconds)'}
              </Text>
              <TextInput
                style={styles.modalInput}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType={editTarget?.type === 'movement-duration' || editTarget?.type === 'all-durations' ? 'number-pad' : 'default'}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={commitEdit}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setEditTarget(null)} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={commitEdit} style={styles.modalConfirm}>
                  <Text style={styles.modalConfirmText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: Colors.textMuted, fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelBtn: { color: Colors.textSecondary, fontSize: 15 },
  deleteWorkoutBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center' as const },
  deleteWorkoutText: { color: Colors.error, fontSize: 14, fontWeight: '600' as const },
  headerTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  saveBtn: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
  saveBtnDim: { opacity: 0.5 },
  footerBtns: { flexDirection: 'row', gap: 10, marginTop: 24, paddingBottom: 8 },
  footerBtnPrimary: {
    flex: 1, height: 52, borderRadius: 14, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  footerBtnPrimaryText: { color: '#000', fontSize: 16, fontWeight: '800' },
  footerBtnSecondary: {
    flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  footerBtnSecondaryText: { color: Colors.text, fontSize: 16, fontWeight: '600' },

  titleRow: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workoutTitle: { color: Colors.text, fontSize: 22, fontWeight: '700', flex: 1 },
  editHint: { color: Colors.textMuted, fontSize: 12 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  sectionMeta: {
    gap: 3,
  },
  sectionLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHint: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  setAllBtnWrap: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setAllBtn: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  thumb: { width: 72, height: 72 },
  thumbPlaceholder: { backgroundColor: Colors.surfaceAlt },
  cardBody: { flex: 1, gap: 4, paddingHorizontal: 12, paddingVertical: 12 },
  movementName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  movementDuration: { color: Colors.textSecondary, fontSize: 13 },

  cardActions: { flexDirection: 'column', alignItems: 'center', paddingRight: 4 },
  actionBtn: { padding: 7 },
  actionIcon: { color: Colors.textSecondary, fontSize: 15 },
  deleteIcon: { color: Colors.error },
  dragHandle: { color: Colors.textMuted, fontSize: 18 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  modalInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.textSecondary, fontSize: 15 },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.accent,
  },
  modalConfirmText: { color: '#000', fontSize: 15, fontWeight: '700' },
});

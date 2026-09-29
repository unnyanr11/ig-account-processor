import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { List } from '../types/list';
import { ThemeColors } from '../utils/theme';

interface Props {
  visible: boolean;
  lists: List[];
  selectedId: number | null;
  colors: ThemeColors;
  onSelect: (listId: number | null) => void;
  onCancel: () => void;
}

export default function ListPickerDialog({ visible, lists, selectedId, colors, onSelect, onCancel }: Props) {
  const options: { id: number | null; name: string }[] = [{ id: null, name: 'No list' }, ...lists];

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole='header'>Move to list</Text>
          <ScrollView style={styles.scroll}>
            {options.map((option) => {
              const selected = option.id === selectedId;
              return (
                <Pressable
                  key={option.id ?? 'none'}
                  onPress={() => onSelect(option.id)}
                  accessibilityRole='button'
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.name}
                  style={[styles.option, { backgroundColor: selected ? colors.primary : colors.surfaceAlt }]}
                >
                  <Text style={[styles.optionText, { color: selected ? '#FFFFFF' : colors.text }]}>{selected ? '✓  ' : ''}{option.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={onCancel} accessibilityRole='button' accessibilityLabel='Cancel' style={[styles.cancel, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.optionText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '80%', borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  scroll: { flexGrow: 0 },
  option: { minHeight: 52, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 16, marginBottom: 8 },
  optionText: { fontSize: 16, fontWeight: '700' },
  cancel: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

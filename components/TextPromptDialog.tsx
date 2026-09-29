import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ThemeColors } from '../utils/theme';

interface Props {
  visible: boolean;
  title: string;
  confirmLabel: string;
  colors: ThemeColors;
  initialValue?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const MAX_LENGTH = 60;

/** Cross-platform text prompt (Alert.prompt only exists on iOS). */
export default function TextPromptDialog({ visible, title, confirmLabel, colors, initialValue = '', placeholder, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole='header'>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            maxLength={MAX_LENGTH}
            autoFocus
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={title}
            onSubmitEditing={() => trimmed && onSubmit(trimmed)}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          />
          <View style={styles.row}>
            <Pressable onPress={onCancel} accessibilityRole='button' accessibilityLabel='Cancel' style={[styles.button, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(trimmed)}
              disabled={!trimmed}
              accessibilityRole='button'
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: !trimmed }}
              style={[styles.button, { backgroundColor: colors.primary, opacity: trimmed ? 1 : 0.5 }]}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 20, gap: 14 },
  title: { fontSize: 18, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 50, paddingHorizontal: 14, fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  button: { minHeight: 48, minWidth: 96, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
});

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../utils/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  colors: ThemeColors;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  visible, title, message, colors, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, onConfirm, onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole='header'>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          <View style={styles.row}>
            <Pressable onPress={onCancel} accessibilityRole='button' accessibilityLabel={cancelLabel} style={[styles.button, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.buttonText, { color: colors.text }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} accessibilityRole='button' accessibilityLabel={confirmLabel} style={[styles.button, { backgroundColor: destructive ? colors.danger : colors.primary }]}>
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
  dialog: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  message: { fontSize: 15, lineHeight: 21, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  button: { minHeight: 48, minWidth: 96, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
});

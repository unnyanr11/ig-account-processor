import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../utils/theme';

interface Props {
  message: string;
  colors: ThemeColors;
  onUndo: () => void;
}

/** Temporary confirmation with an UNDO action. */
export default function UndoBar({ message, colors, onUndo }: Props) {
  return (
    <View style={[styles.bar, { backgroundColor: colors.text }]} accessibilityLiveRegion='polite'>
      <Text style={[styles.message, { color: colors.background }]} numberOfLines={2}>{message}</Text>
      <Pressable onPress={onUndo} accessibilityRole='button' accessibilityLabel='Undo status change' style={styles.button} hitSlop={8}>
        <Text style={[styles.buttonText, { color: colors.primary }]}>UNDO</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 12, marginBottom: 12, paddingLeft: 16, borderRadius: 12 },
  message: { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 14 },
  button: { minHeight: 48, minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 15, fontWeight: '800' },
});

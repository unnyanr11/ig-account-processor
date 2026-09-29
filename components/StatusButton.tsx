import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AccountStatus, STATUS_COLORS, STATUS_LABELS, STATUS_SYMBOLS } from '../types/account';
import { ThemeColors } from '../utils/theme';

interface Props {
  status: AccountStatus;
  onPress: () => void;
  colors: ThemeColors;
  selected?: boolean;
  disabled?: boolean;
}

/** Large status button. Shows a symbol and text as well as color, so color is never the only cue. */
export default function StatusButton({ status, onPress, colors, selected = false, disabled = false }: Props) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole='button'
      accessibilityLabel={`Mark as ${label}`}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.button,
        { borderColor: color, backgroundColor: selected ? color : colors.surface, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.text, { color: selected ? '#FFFFFF' : color }]} numberOfLines={1}>
        {STATUS_SYMBOLS[status]}  {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 2, borderRadius: 14, minHeight: 56, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});

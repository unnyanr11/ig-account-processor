import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ThemeColors } from '../utils/theme';

export interface FilterOption {
  key: string;
  label: string;
}

interface Props {
  options: FilterOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  colors: ThemeColors;
}

export default function FilterBar({ options, selectedKey, onSelect, colors }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((option) => {
        const selected = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole='button'
            accessibilityLabel={`Filter: ${option.label}`}
            accessibilityState={{ selected }}
            style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surfaceAlt, borderColor: selected ? colors.primary : colors.border }]}
          >
            <Text style={[styles.text, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 13, fontWeight: '700' },
});

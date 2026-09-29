import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ThemeColors } from '../utils/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  colors: ThemeColors;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, colors, placeholder = 'Search username, notes or source' }: Props) {
  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel='Search accounts'
        autoCapitalize='none'
        autoCorrect={false}
        returnKeyType='search'
        style={[styles.input, { color: colors.text }]}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} accessibilityRole='button' accessibilityLabel='Clear search' style={styles.clear} hitSlop={8}>
          <Text style={[styles.clearText, { color: colors.textSecondary }]}>{'✕'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, minHeight: 48, paddingLeft: 14 },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
  clear: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 16, fontWeight: '700' },
});

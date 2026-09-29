import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../utils/theme';

interface Props {
  title: string;
  message?: string;
  colors: ThemeColors;
}

export default function EmptyState({ title, message, colors }: Props) {
  return (
    <View style={styles.container} accessible accessibilityLabel={message ? `${title}. ${message}` : title}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48, gap: 8 },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});

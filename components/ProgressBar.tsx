import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../utils/theme';

interface Props {
  current: number;
  total: number;
  colors: ThemeColors;
  label?: string;
}

export default function ProgressBar({ current, total, colors, label }: Props) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  const fraction = `${current.toLocaleString()} / ${total.toLocaleString()}`;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole='progressbar'
      accessibilityLabel={`${label ? label + ', ' : ''}${fraction}`}
      accessibilityValue={{ min: 0, max: total, now: current }}
    >
      <Text style={[styles.fraction, { color: colors.text }]}>{fraction}</Text>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.primary }]} />
      </View>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', gap: 8 },
  fraction: { fontSize: 28, fontWeight: '800' },
  track: { height: 10, borderRadius: 6, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: 6 },
  label: { fontSize: 13 },
});

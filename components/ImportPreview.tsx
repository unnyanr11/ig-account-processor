import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ImportSummary } from '../services/importService';
import { ThemeColors } from '../utils/theme';

interface Props {
  summary: ImportSummary;
  colors: ThemeColors;
}

const SAMPLE_SHOWN = 8;

function Row({ label, value, colors, strong }: { label: string; value: number; colors: ThemeColors; strong?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value.toLocaleString()}`}>
      <Text style={[styles.label, { color: strong ? colors.text : colors.textSecondary, fontWeight: strong ? '800' : '500' }]}>{label}</Text>
      <Text style={[styles.value, { color: strong ? colors.primary : colors.text }]}>{value.toLocaleString()}</Text>
    </View>
  );
}

export default function ImportPreview({ summary, colors }: Props) {
  const shown = summary.sample.slice(0, SAMPLE_SHOWN);
  const more = summary.newCount - shown.length;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole='header'>Import Preview</Text>
      <Text style={[styles.source, { color: colors.textMuted }]} numberOfLines={1}>{summary.source}</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row label='Records detected' value={summary.totalDetected} colors={colors} />
        <Row label='New accounts' value={summary.newCount} colors={colors} strong />
        <Row label='Already in database' value={summary.alreadyInDbCount} colors={colors} />
        <Row label='Duplicates in file' value={summary.duplicatesInFileCount} colors={colors} />
        <Row label='Invalid entries' value={summary.invalidCount} colors={colors} />
      </View>

      {shown.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {shown.map((name) => (
            <Text key={name} style={[styles.sample, { color: colors.text }]}>@{name}</Text>
          ))}
          {more > 0 ? <Text style={[styles.sample, { color: colors.textMuted }]}>... and {more.toLocaleString()} more</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  source: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 15 },
  value: { fontSize: 16, fontWeight: '800' },
  sample: { fontSize: 15, paddingVertical: 2 },
});

import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { accountRepository, listRepository, type StatusCounts } from '../database';
import { AccountStatus, ACCOUNT_STATUSES, STATUS_COLORS, STATUS_LABELS, STATUS_SYMBOLS } from '../types/account';
import type { ListWithStats } from '../types/list';
import { toUserMessage } from '../services/errors';
import { useTheme } from '../utils/useTheme';
import ProgressBar from '../components/ProgressBar';

function percent(part: number, whole: number): string {
  return whole === 0 ? '0.0%' : `${((part / whole) * 100).toFixed(1)}%`;
}

export default function StatisticsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [unassigned, setUnassigned] = useState<StatusCounts | null>(null);
  const [lists, setLists] = useState<ListWithStats[]>([]);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [overall, perList, none] = await Promise.all([
            accountRepository.getStatusCounts(),
            listRepository.getAllWithStats(),
            accountRepository.getStatusCounts(null),
          ]);
          if (!active) return;
          setCounts(overall);
          setLists(perList);
          setUnassigned(none);
          setError('');
        } catch (e) {
          if (active) setError(toUserMessage(e));
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const total = counts?.total ?? 0;
  const newCount = counts?.byStatus[AccountStatus.NEW] ?? 0;
  const processed = total - newCount;
  const unassignedProcessed = unassigned ? unassigned.total - unassigned.byStatus[AccountStatus.NEW] : 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Statistics' }} />
      {error ? <Text style={{ color: colors.danger, fontSize: 15 }}>{error}</Text> : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>TOTAL IMPORTED</Text>
        <Text style={[styles.big, { color: colors.text }]}>{total.toLocaleString()}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>PROCESSED</Text>
        <Text style={[styles.big, { color: colors.text }]}>{processed.toLocaleString()} / {total.toLocaleString()}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>PROGRESS</Text>
        <Text style={[styles.big, { color: colors.primary }]}>{percent(processed, total)}</Text>
        <ProgressBar current={processed} total={total} colors={colors} />

        <Text style={[styles.note, { color: colors.textMuted }]}>
          Imported means an account was added to the app. Processed means you gave it a status other than New.
        </Text>
      </View>

      <Text style={[styles.section, { color: colors.textSecondary }]}>By status</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {ACCOUNT_STATUSES.map((status) => (
          <View key={status} style={styles.row} accessible accessibilityLabel={`${STATUS_LABELS[status]}: ${(counts?.byStatus[status] ?? 0).toLocaleString()}`}>
            <Text style={[styles.rowLabel, { color: STATUS_COLORS[status] }]}>{STATUS_SYMBOLS[status]}  {STATUS_LABELS[status].toUpperCase()}</Text>
            <Text style={[styles.rowValue, { color: STATUS_COLORS[status] }]}>{(counts?.byStatus[status] ?? 0).toLocaleString()}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.section, { color: colors.textSecondary }]}>By list</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {lists.length === 0 && (unassigned?.total ?? 0) === 0 ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>No lists yet.</Text>
        ) : null}
        {lists.map((list) => (
          <View key={list.id} style={styles.listRow} accessible accessibilityLabel={`${list.name}: ${list.processed} of ${list.total} processed`}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>{list.name}</Text>
              <Text style={[styles.rowValue, { color: colors.text }]}>{list.processed.toLocaleString()} / {list.total.toLocaleString()}  ({percent(list.processed, list.total)})</Text>
            </View>
          </View>
        ))}
        {lists.length > 0 && (unassigned?.total ?? 0) > 0 ? (
          <View style={styles.row} accessible accessibilityLabel={`No list: ${unassignedProcessed} of ${unassigned?.total ?? 0} processed`}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>No list</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{unassignedProcessed.toLocaleString()} / {(unassigned?.total ?? 0).toLocaleString()}  ({percent(unassignedProcessed, unassigned?.total ?? 0)})</Text>
          </View>
        ) : null}
      </View>

      <Pressable onPress={() => router.push('/export')} accessibilityRole='button' accessibilityLabel='Export accounts' style={[styles.button, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.buttonText, { color: colors.text }]}>Export Accounts</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  big: { fontSize: 30, fontWeight: '800' },
  note: { fontSize: 13, lineHeight: 19 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  listRow: { gap: 4 },
  rowLabel: { flexShrink: 1, fontSize: 15, fontWeight: '700' },
  rowValue: { fontSize: 15, fontWeight: '800' },
  button: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});

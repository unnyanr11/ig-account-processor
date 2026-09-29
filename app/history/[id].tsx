import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { historyRepository, type AccountFilters } from '../../database';
import type { ImportBatch } from '../../types/history';
import { formatDateHuman } from '../../utils/normalization';
import { useTheme } from '../../utils/useTheme';
import AccountBrowser from '../../components/AccountBrowser';

export default function ImportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const batchId = Number(id);
  const { colors } = useTheme();
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [missing, setMissing] = useState(false);

  const baseFilters = useMemo<AccountFilters>(() => ({ importBatchId: batchId }), [batchId]);

  useEffect(() => {
    historyRepository
      .getImportBatch(batchId)
      .then((found) => (found ? setBatch(found) : setMissing(true)))
      .catch(() => setMissing(true));
  }, [batchId]);

  if (missing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Import' }} />
        <Text style={[styles.body, { color: colors.text }]}>This import could not be found.</Text>
      </View>
    );
  }

  const header = batch ? (
    <View style={styles.header}>
      <Text style={[styles.name, { color: colors.text }]} accessibilityRole='header'>{batch.file_name}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>{formatDateHuman(batch.created_at)}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        {batch.total_records.toLocaleString()} records  {'·'}  {batch.new_records.toLocaleString()} new  {'·'}  {batch.duplicate_records.toLocaleString()} duplicates  {'·'}  {batch.invalid_records.toLocaleString()} invalid
      </Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        The list below includes accounts that were already in the app when this file was imported.
      </Text>
    </View>
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: batch?.file_name ?? 'Import' }} />
      <AccountBrowser baseFilters={baseFilters} header={header} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  body: { fontSize: 16, textAlign: 'center' },
  header: { gap: 6 },
  name: { fontSize: 20, fontWeight: '800' },
  meta: { fontSize: 14 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 4 },
});

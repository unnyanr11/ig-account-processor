import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { accountRepository, listRepository, type AccountFilters } from '../database';
import { AccountStatus, ACCOUNT_STATUSES, STATUS_LABELS } from '../types/account';
import type { List } from '../types/list';
import { toUserMessage } from '../services/errors';
import { exportAccounts, type ExportFormat } from '../services/exportService';
import { ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/useTheme';

const FORMATS: { key: ExportFormat; label: string }[] = [
  { key: 'csv', label: 'CSV' },
  { key: 'txt', label: 'TXT' },
  { key: 'xlsx', label: 'XLSX' },
];

function Chip({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: ThemeColors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surfaceAlt, borderColor: selected ? colors.primary : colors.border }]}
    >
      <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

export default function ExportScreen() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<'ALL' | AccountStatus>('ALL');
  const [listId, setListId] = useState<number | undefined>(undefined);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [lists, setLists] = useState<List[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const filters = useMemo<AccountFilters>(() => ({ status: status === 'ALL' ? undefined : status, listId }), [status, listId]);

  useEffect(() => {
    listRepository.getAll().then(setLists).catch(() => setLists([]));
  }, []);

  useEffect(() => {
    let active = true;
    accountRepository.count(filters).then((n) => active && setCount(n)).catch(() => active && setCount(null));
    return () => {
      active = false;
    };
  }, [filters]);

  const runExport = async () => {
    setBusy(true);
    setMessage('');
    try {
      const exported = await exportAccounts(filters, format, status === 'ALL' ? 'all' : status.toLowerCase());
      setIsError(false);
      setMessage(`Exported ${exported.toLocaleString()} accounts.`);
    } catch (e) {
      setIsError(true);
      setMessage(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || count === 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Export Accounts' }} />

      <Text style={[styles.section, { color: colors.textSecondary }]}>Which accounts</Text>
      <View style={styles.chips}>
        <Chip label='All Accounts' selected={status === 'ALL'} colors={colors} onPress={() => setStatus('ALL')} />
        {ACCOUNT_STATUSES.map((s) => (
          <Chip key={s} label={STATUS_LABELS[s]} selected={status === s} colors={colors} onPress={() => setStatus(s)} />
        ))}
      </View>

      {lists.length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.textSecondary }]}>Which list</Text>
          <View style={styles.chips}>
            <Chip label='All lists' selected={listId === undefined} colors={colors} onPress={() => setListId(undefined)} />
            {lists.map((list) => (
              <Chip key={list.id} label={list.name} selected={listId === list.id} colors={colors} onPress={() => setListId(list.id)} />
            ))}
          </View>
        </>
      ) : null}

      <Text style={[styles.section, { color: colors.textSecondary }]}>Format</Text>
      <View style={styles.chips}>
        {FORMATS.map((f) => (
          <Chip key={f.key} label={f.label} selected={format === f.key} colors={colors} onPress={() => setFormat(f.key)} />
        ))}
      </View>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        CSV and XLSX include username, instagram_url, status, list, source, notes, created_at and updated_at. TXT contains usernames only, one per line.
      </Text>

      <Text style={[styles.count, { color: colors.text }]} accessibilityLiveRegion='polite'>
        {count === null ? '' : `${count.toLocaleString()} accounts will be exported`}
      </Text>

      <Pressable
        onPress={() => void runExport()}
        disabled={disabled}
        accessibilityRole='button'
        accessibilityLabel='Export'
        accessibilityState={{ disabled }}
        style={[styles.button, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={styles.buttonText}>{busy ? 'Preparing file...' : 'Export'}</Text>
      </Pressable>

      {message ? (
        <Text style={[styles.message, { color: isError ? colors.danger : colors.textSecondary }]} accessibilityLiveRegion='polite'>{message}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 19 },
  count: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  button: { minHeight: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  message: { fontSize: 15, lineHeight: 22 },
});

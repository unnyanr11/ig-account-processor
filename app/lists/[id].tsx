import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { accountRepository, listRepository, type AccountFilters } from '../../database';
import { AccountStatus } from '../../types/account';
import type { List } from '../../types/list';
import { toUserMessage } from '../../services/errors';
import { useTheme } from '../../utils/useTheme';
import AccountBrowser from '../../components/AccountBrowser';
import ConfirmDialog from '../../components/ConfirmDialog';
import TextPromptDialog from '../../components/TextPromptDialog';

type DeleteMode = 'keep' | 'all' | null;

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = Number(id);
  const router = useRouter();
  const { colors } = useTheme();

  const [list, setList] = useState<List | null>(null);
  const [total, setTotal] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [missing, setMissing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);

  const baseFilters = useMemo<AccountFilters>(() => ({ listId }), [listId]);

  const load = useCallback(async () => {
    try {
      const [found, counts] = await Promise.all([listRepository.getById(listId), accountRepository.getStatusCounts(listId)]);
      if (!found) {
        setMissing(true);
        return;
      }
      setList(found);
      setTotal(counts.total);
      setNewCount(counts.byStatus[AccountStatus.NEW]);
    } catch (e) {
      Alert.alert('Something went wrong', toUserMessage(e));
    }
  }, [listId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const rename = async (name: string) => {
    setRenaming(false);
    try {
      await listRepository.rename(listId, name);
      await load();
    } catch (e) {
      Alert.alert('Could not rename list', toUserMessage(e));
    }
  };

  const confirmDelete = async () => {
    const mode = deleteMode;
    setDeleteMode(null);
    if (!mode) return;
    try {
      await listRepository.remove(listId, mode === 'all');
      router.replace('/lists');
    } catch (e) {
      Alert.alert('Could not delete list', toUserMessage(e));
    }
  };

  if (missing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'List' }} />
        <Text style={[styles.body, { color: colors.text }]}>This list could not be found. It may have been deleted.</Text>
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <Text style={[styles.name, { color: colors.text }]} accessibilityRole='header'>{list?.name ?? ''}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        {total.toLocaleString()} accounts  {'·'}  {(total - newCount).toLocaleString()} processed  {'·'}  {newCount.toLocaleString()} new
      </Text>

      <Pressable
        onPress={() => router.push({ pathname: '/queue', params: { listId: String(listId) } })}
        disabled={newCount === 0}
        accessibilityRole='button'
        accessibilityLabel='Process this list'
        accessibilityState={{ disabled: newCount === 0 }}
        style={[styles.primary, { backgroundColor: colors.primary, opacity: newCount === 0 ? 0.5 : 1 }]}
      >
        <Text style={styles.primaryText}>{newCount === 0 ? 'Nothing left to process' : 'Process This List'}</Text>
      </Pressable>

      <View style={styles.row}>
        <Pressable onPress={() => setRenaming(true)} accessibilityRole='button' accessibilityLabel='Rename list' style={[styles.secondary, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.secondaryText, { color: colors.text }]}>Rename</Text>
        </Pressable>
        <Pressable onPress={() => setDeleteMode('keep')} accessibilityRole='button' accessibilityLabel='Delete list and keep accounts' style={[styles.secondary, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.secondaryText, { color: colors.danger }]}>Delete List</Text>
        </Pressable>
      </View>
      {total > 0 ? (
        <Pressable onPress={() => setDeleteMode('all')} accessibilityRole='button' accessibilityLabel='Delete list and all its accounts' style={[styles.danger, { borderColor: colors.danger }]}>
          <Text style={[styles.secondaryText, { color: colors.danger }]}>Delete List and Its Accounts</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: list?.name ?? 'List' }} />
      <AccountBrowser baseFilters={baseFilters} header={header} />

      <TextPromptDialog
        visible={renaming}
        title='Rename list'
        initialValue={list?.name ?? ''}
        confirmLabel='Save'
        colors={colors}
        onSubmit={(name) => void rename(name)}
        onCancel={() => setRenaming(false)}
      />

      <ConfirmDialog
        visible={deleteMode === 'keep'}
        colors={colors}
        title='Delete this list?'
        message={`The list will be removed. Its ${total.toLocaleString()} accounts are kept and will no longer belong to a list.`}
        confirmLabel='Delete List'
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteMode(null)}
      />

      <ConfirmDialog
        visible={deleteMode === 'all'}
        colors={colors}
        title='Delete list and accounts?'
        message={`This permanently deletes the list and its ${total.toLocaleString()} accounts, including their notes and history. This cannot be undone.`}
        confirmLabel='Delete Everything'
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteMode(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  body: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  header: { gap: 12 },
  name: { fontSize: 24, fontWeight: '800' },
  meta: { fontSize: 14 },
  primary: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12 },
  secondary: { flex: 1, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '700' },
  danger: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

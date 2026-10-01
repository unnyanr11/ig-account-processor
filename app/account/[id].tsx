import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { accountRepository, historyRepository, listRepository } from '../../database';
import { AccountStatus, AccountWithList, ACCOUNT_STATUSES, STATUS_COLORS, STATUS_LABELS, STATUS_SYMBOLS } from '../../types/account';
import type { StatusHistoryEntry } from '../../types/history';
import type { List } from '../../types/list';
import { toUserMessage } from '../../services/errors';
import { openProfile } from '../../services/instagram';
import { fetchProfileMetadata } from '../../services/profileImage';
import { downloadImage } from '../../services/imageDownloadService';
import { statusLabel } from '../../utils/format';
import { formatDateHuman, formatDateTimeHuman } from '../../utils/normalization';
import { useSettings } from '../../utils/useSettings';
import { useTheme } from '../../utils/useTheme';
import ListPickerDialog from '../../components/ListPickerDialog';
import StatusButton from '../../components/StatusButton';

type Phase = 'loading' | 'ready' | 'missing' | 'error';

export default function AccountDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const { colors } = useTheme();
  const { settings } = useSettings();

  const [phase, setPhase] = useState<Phase>('loading');
  const [account, setAccount] = useState<AccountWithList | null>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [usernameHistory, setUsernameHistory] = useState<Array<{id:number;old_username:string;new_username:string;changed_at:string}>>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [notes, setNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async (resetNotes: boolean) => {
    if (!Number.isFinite(accountId)) {
      setPhase('missing');
      return;
    }
    try {
      const [found, entries, usernameEntries, allLists] = await Promise.all([
        accountRepository.getById(accountId),
        historyRepository.getForAccount(accountId),
        historyRepository.getUsernameHistory(accountId),
        listRepository.getAll(),
      ]);
      if (!found) {
        setPhase('missing');
        return;
      }
      setAccount(found);
      setHistory(entries);
      setUsernameHistory(usernameEntries);
      setLists(allLists);
      if (resetNotes) setNotes(found.notes ?? '');
      setPhase('ready');
    } catch (e) {
      setMessage(toUserMessage(e));
      setPhase('error');
    }
  }, [accountId]);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (phase !== 'ready' || !account) return;
    if ((account.display_name || account.full_name) && (account.profile_image_uri || account.image_url)) return;
    void (async () => {
      try {
        const metadata = await fetchProfileMetadata({
          username: account.username,
          displayName: account.display_name ?? account.full_name ?? '',
          fullName: account.full_name ?? account.display_name ?? '',
          profileImageUrl: account.image_url ?? account.profile_image_url ?? '',
          profileImageUri: account.profile_image_uri ?? account.local_image_path ?? '',
        });
        await accountRepository.updateMetadata(account.id, {
          display_name: metadata.displayName ?? account.display_name ?? account.full_name ?? null,
          full_name: metadata.fullName ?? metadata.displayName ?? account.full_name ?? account.display_name ?? null,
          image_url: metadata.imageUrl ?? account.image_url ?? null,
          profile_image_uri: metadata.profileImageUri ?? account.profile_image_uri ?? null,
        });
        await load(false);
      } catch {
        // Keep the details screen usable when enrichment fails.
      }
    })();
  }, [account, load, phase]);

  const run = async (task: () => Promise<void>, successMessage = '') => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
      await load(false);
      setMessage(successMessage);
    } catch (e) {
      Alert.alert('Something went wrong', toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: AccountStatus) => run(async () => {
    await accountRepository.setStatus(accountId, status);
  }, `Status updated to ${STATUS_LABELS[status]}`);

  const saveNotes = () => run(async () => {
    await accountRepository.setNotes(accountId, notes);
    setNotes(notes.trim());
  }, 'Notes saved');

  const moveToList = (listId: number | null) => {
    setPickerOpen(false);
    void run(async () => {
      await accountRepository.moveToList(accountId, listId);
    }, 'List updated');
  };

  const openInstagram = async () => {
    if (!account) return;
    if (!account.username?.trim()) {
  Alert.alert(
    'Username unavailable',
    'This account does not have a username to open.'
  );
  return;
}

const outcome = await openProfile(account.username, {
      preferApp: settings.preferInstagramApp,
      browserFallback: settings.browserFallback,
    });
    if (!outcome.ok) Alert.alert('Could not open Instagram', outcome.message);
  };

  const downloadLocal = () => run(async () => {
    const remote = account?.profile_image_url ?? account?.image_url;
    if (!account || !remote) throw new Error('No usable image URL is available for this account.');
    const local = await downloadImage(account.id, remote);
    if (!local) throw new Error('The image could not be downloaded.');
    await accountRepository.updateMetadata(account.id, { profile_image_uri: local });
  }, 'Image downloaded locally');

  const refreshIdentity = () => run(async () => {
    if (!account) return;
    const metadata = await fetchProfileMetadata({
      username: account.username,
      displayName: account.display_name ?? account.full_name ?? '',
      fullName: account.full_name ?? account.display_name ?? '',
      profileImageUrl: account.image_url ?? '',
      profileImageUri: account.profile_image_uri ?? '',
    });
    await accountRepository.updateMetadata(account.id, {
      display_name: metadata.displayName ?? account.display_name ?? account.full_name ?? null,
      full_name: metadata.fullName ?? metadata.displayName ?? account.full_name ?? account.display_name ?? null,
      image_url: metadata.imageUrl ?? account.image_url ?? null,
      profile_image_uri: metadata.profileImageUri ?? account.profile_image_uri ?? null,
    });
  }, 'Profile info refreshed');

  const screen = <Stack.Screen options={{ title: account ? `@${account.username}` : 'Account' }} />;

  if (phase === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {screen}
        <ActivityIndicator size='large' color={colors.primary} accessibilityLabel='Loading' />
      </View>
    );
  }

  if (phase !== 'ready' || !account) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {screen}
        <Text style={[styles.body, { color: colors.text }]}>
          {phase === 'missing' ? 'This account could not be found. It may have been deleted.' : message || 'Something went wrong. Please try again.'}
        </Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[account.status];
  const notesDirty = notes.trim() !== (account.notes ?? '');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
      {screen}

      <View style={styles.headerBlock}>
        {(account.profile_image_uri || account.image_url) ? (
          <Image source={{ uri: account.profile_image_uri || account.image_url || undefined }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.avatarPlaceholderText, { color: colors.textMuted }]}>{(account.username?.[0] || '?').toUpperCase()}</Text>
          </View>
        )}
        <Text style={[styles.displayName, { color: colors.text }]} selectable accessibilityRole='header'>{account.display_name || account.full_name || 'Instagram account'}</Text>
        <Text style={[styles.username, { color: colors.textSecondary }]} selectable>@{account.username}</Text>
        <View style={[styles.badge, { borderColor: statusColor }]} accessible accessibilityLabel={`Status ${STATUS_LABELS[account.status]}`}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{STATUS_SYMBOLS[account.status]} {STATUS_LABELS[account.status].toUpperCase()}</Text>
        </View>
      </View>

      {(!(account.display_name || account.full_name) || !(account.profile_image_uri || account.image_url)) ? (
        <Pressable onPress={() => void refreshIdentity()} disabled={busy} accessibilityRole='button' style={[styles.secondary, { backgroundColor: colors.surfaceAlt, opacity: busy ? 0.6 : 1 }]}>
          <Text style={[styles.secondaryText, { color: colors.text }]}>Refresh profile info</Text>
        </Pressable>
      ) : null}

      {(account.profile_image_url || account.image_url) ? <Pressable onPress={() => void downloadLocal()} disabled={busy} accessibilityRole='button' style={[styles.secondary, { backgroundColor: colors.surfaceAlt, opacity: busy ? 0.6 : 1 }]}><Text style={[styles.secondaryText, { color: colors.text }]}>Download Image</Text></Pressable> : null}

      <Pressable onPress={openInstagram} accessibilityRole='button' accessibilityLabel={`Open ${account.username} on Instagram`} style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
        <Text style={styles.primaryText}>Open Instagram</Text>
      </Pressable>

      {message ? <Text style={[styles.message, { color: colors.textSecondary }]} accessibilityLiveRegion='polite'>{message}</Text> : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Field label='Created' value={formatDateHuman(account.created_at)} colors={colors} />
        <Field label='Last Updated' value={formatDateHuman(account.updated_at)} colors={colors} />
        <Field label='Source' value={account.source ?? 'Unknown'} colors={colors} />
        <Field label='List' value={account.list_name ?? 'No list'} colors={colors} />
      </View>

      <Pressable onPress={() => setPickerOpen(true)} disabled={busy} accessibilityRole='button' accessibilityLabel='Move to another list' style={[styles.secondary, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.secondaryText, { color: colors.text }]}>Move to List</Text>
      </Pressable>

      <Text style={[styles.section, { color: colors.textSecondary }]}>Status</Text>
      <View style={styles.statusList}>
        {ACCOUNT_STATUSES.map((status) => (
          <StatusButton key={status} status={status} colors={colors} selected={account.status === status} disabled={busy} onPress={() => void changeStatus(status)} />
        ))}
      </View>

      <Text style={[styles.section, { color: colors.textSecondary }]}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder='Add notes about this account'
        placeholderTextColor={colors.textMuted}
        accessibilityLabel='Notes'
        style={[styles.notes, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />
      <Pressable
        onPress={() => void saveNotes()}
        disabled={!notesDirty || busy}
        accessibilityRole='button'
        accessibilityLabel='Save notes'
        accessibilityState={{ disabled: !notesDirty || busy }}
        style={[styles.primary, { backgroundColor: colors.primary, opacity: notesDirty && !busy ? 1 : 0.5 }]}
      >
        <Text style={styles.primaryText}>Save Notes</Text>
      </Pressable>

      {usernameHistory.length ? <>
        <Text style={[styles.section, { color: colors.textSecondary }]}>Username Changes</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {usernameHistory.map((entry) => <View key={entry.id} style={styles.historyRow} accessible accessibilityLabel={`Username changed from @${entry.old_username} to @${entry.new_username}`}>
            <Text style={[styles.historyDate, { color: colors.textMuted }]}>{formatDateTimeHuman(entry.changed_at)}</Text>
            <Text style={[styles.historyChange, { color: colors.text }]} selectable>@{entry.old_username} {'→'} @{entry.new_username}</Text>
          </View>)}
        </View>
      </> : null}

      <Text style={[styles.section, { color: colors.textSecondary }]}>History</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {history.length === 0 ? (
          <Text style={[styles.body, { color: colors.textMuted }]}>No status changes yet.</Text>
        ) : (
          history.map((entry) => (
            <View key={entry.id} style={styles.historyRow} accessible accessibilityLabel={`${formatDateTimeHuman(entry.created_at)}, ${statusLabel(entry.old_status)} to ${statusLabel(entry.new_status)}`}>
              <Text style={[styles.historyDate, { color: colors.textMuted }]}>{formatDateTimeHuman(entry.created_at)}</Text>
              <Text style={[styles.historyChange, { color: colors.text }]}>{statusLabel(entry.old_status)} {'→'} {statusLabel(entry.new_status)}</Text>
            </View>
          ))
        )}
      </View>

      <ListPickerDialog visible={pickerOpen} lists={lists} selectedId={account.list_id} colors={colors} onSelect={moveToList} onCancel={() => setPickerOpen(false)} />
    </ScrollView>
  );
}

function Field({ label, value, colors }: { label: string; value: string; colors: { text: string; textMuted: string } }) {
  return (
    <View style={styles.field} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: colors.text }]} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  headerBlock: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  avatarPlaceholder: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { fontSize: 28, fontWeight: '800' },
  displayName: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  username: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  badge: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '800' },
  primary: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  secondary: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '700' },
  message: { fontSize: 14, textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: 16, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  statusList: { gap: 10 },
  notes: { borderWidth: 1, borderRadius: 14, minHeight: 110, padding: 14, fontSize: 16, textAlignVertical: 'top' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  historyRow: { gap: 2 },
  historyDate: { fontSize: 12 },
  historyChange: { fontSize: 15, fontWeight: '700' },
});

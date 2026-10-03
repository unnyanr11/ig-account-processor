import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { accountRepository, historyRepository, type AccountFilters } from '../database';
import { AccountStatus, AccountWithList, ACCOUNT_STATUSES, STATUS_COLORS, STATUS_LABELS, STATUS_SYMBOLS } from '../types/account';
import { toUserMessage } from '../services/errors';
import { openProfile } from '../services/instagram';
import { fetchProfileMetadata } from '../services/profileImage';
import { downloadImage, saveAllImagesToDeviceStorage } from '../services/imageDownloadService';
import type { QueueMode } from '../services/settingsService';
import { ThemeColors } from '../utils/theme';
import { useSettings } from '../utils/useSettings';
import { useTheme } from '../utils/useTheme';
import ConfirmDialog from '../components/ConfirmDialog';
import ProgressBar from '../components/ProgressBar';
import StatusButton from '../components/StatusButton';
import FullScreenImage from '../components/FullScreenImage';
import UndoBar from '../components/UndoBar';

const UNDO_MS = 6000;
function FileSwitcher({importId,listId,colors,router}:{importId?:number;listId?:number;colors:ThemeColors;router:any}){
 const [open,setOpen]=useState(false),[batches,setBatches]=useState<any[]>([]);
 useEffect(()=>{historyRepository.getImportBatches().then(setBatches).catch(()=>{});},[]);
 const current=batches.find(x=>x.id===importId);
 return <><Pressable onPress={()=>setOpen(true)} accessibilityRole='button' style={[styles.fileSwitcher,{backgroundColor:colors.surfaceAlt,borderColor:colors.border}]}>
   <Text style={[styles.fileSwitcherLabel,{color:colors.textMuted}]}>Working file</Text><Text style={[styles.fileSwitcherName,{color:colors.text}]} numberOfLines={1}>{current?.file_name??'All imported files'}</Text><Text style={[styles.fileSwitcherAction,{color:colors.primary}]}>Switch</Text>
  </Pressable>
  <Modal visible={open} transparent animationType='fade' onRequestClose={()=>setOpen(false)}>
   <View style={styles.modalBackdrop}><View style={[styles.fileModal,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <Text style={[styles.modalTitle,{color:colors.text}]}>Select file</Text>
    <Pressable onPress={()=>{setOpen(false);router.replace({pathname:'/queue',params:listId?{listId:String(listId)}:{}});}} style={[styles.fileOption,{borderColor:colors.border}]}><Text style={{color:colors.text,fontWeight:'700'}}>All imported files</Text></Pressable>
    <FlatList data={batches} keyExtractor={x=>String(x.id)} style={{maxHeight:360}} renderItem={({item})=><Pressable onPress={()=>{setOpen(false);router.replace({pathname:'/queue',params:{importId:String(item.id),...(listId?{listId:String(listId)}:{})}});}} style={[styles.fileOption,{borderColor:colors.border}]}><Text style={{color:colors.text,fontWeight:'700'}} numberOfLines={2}>{item.file_name}</Text><Text style={{color:colors.textMuted,fontSize:12}}>{item.total_records.toLocaleString()} records • {new Date(item.created_at).toLocaleString()}</Text></Pressable>}/>
    <Pressable onPress={()=>setOpen(false)} style={[styles.cancelButton,{backgroundColor:colors.surfaceAlt}]}><Text style={{color:colors.text,fontWeight:'700'}}>Cancel</Text></Pressable>
   </View></View>
  </Modal></>;
}

const MODES: { key: QueueMode; label: string }[] = [
  { key: 'UNPROCESSED', label: 'Unprocessed only' },
  { key: 'ALL', label: 'All accounts' },
  { key: 'STATUS', label: 'Selected status' },
];

type Phase = 'loading' | 'ready' | 'empty' | 'done' | 'error';
interface UndoState {
  accountId: number;
  previous: AccountStatus;
  next: AccountStatus;
}

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

export default function QueueScreen() {
  const params = useLocalSearchParams<{ startId?: string; listId?: string; importId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { settings, loaded, update } = useSettings();

  const listId = params.listId ? Number(params.listId) : undefined;
  const importId = params.importId ? Number(params.importId) : undefined;
  const scope = useMemo<AccountFilters>(() => ({ listId, importId }), [listId, importId]);
  // Next follows the processing mode; Previous always walks every account so mistakes can be reviewed.
  const modeFilter = useMemo<AccountFilters>(() => {
    if (settings.queueMode === 'UNPROCESSED') return { listId, importId, status: AccountStatus.NEW };
    if (settings.queueMode === 'STATUS') return { listId, importId, status: settings.queueStatus };
    return { listId, importId };
  }, [listId, settings.queueMode, settings.queueStatus]);

  const [phase, setPhase] = useState<Phase>('loading');
  const [account, setAccount] = useState<AccountWithList | null>(null);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [errorText, setErrorText] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<AccountStatus | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptedIdentityLoads = useRef(new Set<number>());

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const guard = useCallback(async (task: () => Promise<void>) => {
    try {
      await task();
    } catch (error) {
      setErrorText(toUserMessage(error));
      setPhase('error');
    }
  }, []);

  const show = useCallback(async (id: number) => {
    const [found, pos, count, left] = await Promise.all([
      accountRepository.getById(id),
      accountRepository.getPosition(scope, id),
      accountRepository.count(scope),
      accountRepository.count(modeFilter),
    ]);
    if (!found) {
      setPhase('empty');
      return;
    }
    setAccount(found);
    setPosition(pos);
    setTotal(count);
    setRemaining(left);
    setPhase('ready');
  }, [scope, modeFilter]);

  useEffect(() => {
    if (!loaded) return;
    guard(async () => {
      let id: number | null = params.startId ? Number(params.startId) : null;
      if (id === null) {
        id = settings.queueMode === 'STATUS'
          ? await accountRepository.getFirstId(modeFilter)
          : (await accountRepository.getFirstId({ ...scope, status: AccountStatus.NEW })) ?? (await accountRepository.getFirstId(scope));
      }
      if (id === null) setPhase('empty');
      else await show(id);
    });
    // Runs on first load and on retry only; changing the mode must not move the current account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, reloadKey, importId]);

  const goNext = useCallback(async (fromId: number) => {
    setNotice('');
    let id = await accountRepository.getAdjacentId(modeFilter, fromId, 'next');
    if (id === null && settings.queueMode === 'UNPROCESSED') {
      id = await accountRepository.getFirstId(modeFilter);
    }
    if (id !== null) {
      await show(id);
      return;
    }
    if (settings.queueMode === 'UNPROCESSED') {
      const left = await accountRepository.count({ ...scope, status: AccountStatus.NEW });
      setRemaining(left);
      setPhase('done');
    } else {
      setNotice('That was the last account.');
      await show(fromId);
    }
  }, [modeFilter, scope, settings.queueMode, show]);

  const goPrevious = useCallback(async (fromId: number) => {
    setNotice('');
    const id = await accountRepository.getAdjacentId(scope, fromId, 'prev');
    if (id === null) {
      setNotice('This is the first account.');
      return;
    }
    await show(id);
  }, [scope, show]);

  const clearUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndo(null);
  }, []);

  const armUndo = useCallback((state: UndoState) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(state);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }, []);

  const commitStatus = useCallback(async (next: AccountStatus) => {
    if (!account || busy) return;
    setBusy(true);
    try {
      const previous = await accountRepository.setStatus(account.id, next);
      if (previous !== next) armUndo({ accountId: account.id, previous, next });
      if (settings.autoNext) await goNext(account.id);
      else await show(account.id);
    } catch (error) {
      Alert.alert('Could not save', toUserMessage(error));
    } finally {
      setBusy(false);
    }
  }, [account, busy, armUndo, goNext, settings.autoNext, show]);

  const requestStatus = (next: AccountStatus) => {
    if (settings.confirmStatusChanges) setPendingStatus(next);
    else void commitStatus(next);
  };

  const handleUndo = useCallback(async () => {
    if (!undo || busy) return;
    const state = undo;
    clearUndo();
    setBusy(true);
    try {
      // Restoring goes through setStatus, so the reversal is written to history too.
      await accountRepository.setStatus(state.accountId, state.previous);
      await show(state.accountId);
    } catch (error) {
      Alert.alert('Could not undo', toUserMessage(error));
    } finally {
      setBusy(false);
    }
  }, [undo, busy, clearUndo, show]);

  const saveToDevice = async () => {
    if (!account) return;
    setBusy(true);
    try {
      const result = await saveAllImagesToDeviceStorage(account.id, account.model_name ?? account.display_name ?? account.full_name, (done,total) => setNotice(`Downloading images ${done}/${total}…`));
      setNotice(result.saved ? `${result.saved} image${result.saved===1?'':'s'} saved in the model folder.${result.failed ? ` ${result.failed} failed.` : ''}` : 'No images were saved. Choose a storage folder and try again.');
    } catch {
      setNotice('Could not save the images to device storage.');
    } finally { setBusy(false); }
  };

  const handleOpen = async () => {
    if (!account?.username?.trim()) {
      Alert.alert('Instagram unavailable', 'IG username not available');
      return;
    }
    const outcome = await openProfile(account.username, {
      preferApp: settings.preferInstagramApp,
      browserFallback: settings.browserFallback,
    });
    if (!outcome.ok) Alert.alert('Could not open Instagram', outcome.message);
  };

  const handleOpenX = async () => {
    if (!account?.x_username?.trim()) {
      Alert.alert('X unavailable', 'X username not available');
      return;
    }
    try { await Linking.openURL(account.x_url || `https://x.com/${encodeURIComponent(account.x_username)}/`); }
    catch { Alert.alert('Could not open X', 'The X profile could not be opened.'); }
  };

  const handleOpenTikTok = async () => {
    if (!account?.tiktok_username?.trim()) {
      Alert.alert('TikTok unavailable', 'TikTok username not available');
      return;
    }
    try { await Linking.openURL(account.tiktok_url || `https://www.tiktok.com/@${encodeURIComponent(account.tiktok_username)}`); }
    catch { Alert.alert('Could not open TikTok', 'The TikTok profile could not be opened.'); }
  };

  const refreshIdentity = useCallback(async (force = false) => {
    if (!account || busy) return;
    const needsIdentity = !account.display_name && !account.full_name;
    const needsImage = !account.profile_image_uri && !account.image_url;
    if (!force && !needsIdentity && !needsImage) return;

    setBusy(true);
    try {
      const remoteImage = account.image_url ?? account.profile_image_url ?? null;
      if (remoteImage && !account.profile_image_uri && !account.local_image_path) {
        const localUri = await downloadImage(account.id, remoteImage);
        if (localUri) {
          await show(account.id);
          return;
        }
      }

      const metadata = await fetchProfileMetadata({
        username: account.username,
        displayName: account.display_name ?? account.full_name ?? '',
        fullName: account.full_name ?? account.display_name ?? '',
        profileImageUrl: remoteImage ?? '',
        profileImageUri: account.profile_image_uri ?? account.local_image_path ?? '',
      });
      await accountRepository.updateMetadata(account.id, {
        display_name: metadata.displayName ?? account.display_name ?? account.full_name ?? null,
        full_name: metadata.fullName ?? account.full_name ?? account.display_name ?? null,
        image_url: metadata.imageUrl ?? remoteImage ?? null,
        profile_image_uri: metadata.profileImageUri ?? account.profile_image_uri ?? account.local_image_path ?? null,
      });
      await show(account.id);
    } catch {
      setNotice('Profile details could not be refreshed right now.');
    } finally {
      setBusy(false);
    }
  }, [account, busy, show]);

  useEffect(() => {
    if (!account || phase !== 'ready') return;
    if (attemptedIdentityLoads.current.has(account.id)) return;
    if ((account.display_name || account.full_name) && (account.profile_image_uri || account.image_url)) return;
    attemptedIdentityLoads.current.add(account.id);
    void refreshIdentity(false);
  }, [account, phase, refreshIdentity]);

  const message = (text: string, actionLabel?: string, action?: () => void) => (
    <View style={styles.center}>
      <Text style={[styles.centerText, { color: colors.text }]}>{text}</Text>
      {actionLabel && action ? (
        <Pressable onPress={action} accessibilityRole='button' style={[styles.primary, { backgroundColor: colors.primary }]}>
          <Text style={styles.primaryText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  let body: React.ReactNode;
  if (phase === 'loading') {
    body = <View style={styles.center}><ActivityIndicator size='large' color={colors.primary} accessibilityLabel='Loading' /></View>;
  } else if (phase === 'error') {
    body = message(errorText || 'Something went wrong. Please try again.', 'Try again', () => { setPhase('loading'); setReloadKey((k) => k + 1); });
  } else if (phase === 'empty') {
    body = message('There are no accounts to process yet.', 'Import accounts', () => router.push('/import'));
  } else if (phase === 'done') {
    body = message('All caught up. There are no unprocessed accounts left.', 'Back to dashboard', () => router.replace('/'));
  } else if (account) {
    const statusColor = STATUS_COLORS[account.status];
    body = (
      <>
        <ProgressBar current={position} total={total} colors={colors} label={`${remaining.toLocaleString()} unprocessed left`} />
        <FileSwitcher importId={importId} listId={listId} colors={colors} router={router} />

        <View style={styles.modeRow}>
          {MODES.map((mode) => (
            <Chip key={mode.key} label={mode.label} selected={settings.queueMode === mode.key} colors={colors} onPress={() => void update('queueMode', mode.key)} />
          ))}
        </View>
        {settings.queueMode === 'STATUS' ? (
          <View style={styles.modeRow}>
            {ACCOUNT_STATUSES.map((s) => (
              <Chip key={s} label={STATUS_LABELS[s]} selected={settings.queueStatus === s} colors={colors} onPress={() => void update('queueStatus', s)} />
            ))}
          </View>
        ) : null}

        <View style={styles.accountBlock}>
          {(account.profile_image_uri || account.local_image_path || account.image_url || account.profile_image_url) ? (
            <FullScreenImage accountId={account.id} uri={account.profile_image_uri || account.local_image_path || account.image_url || account.profile_image_url} size={92} textColor={colors.text} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.avatarPlaceholderText, { color: colors.textMuted }]}>{(account.username?.[0] || account.model_name?.[0] || '?').toUpperCase()}</Text>
            </View>
          )}
          <Text style={[styles.displayName, { color: colors.text }]} accessibilityRole='header' numberOfLines={2}>
            {account.model_name || account.display_name || account.full_name || 'Unnamed model'}
          </Text>
          <Text style={[styles.username, { color: colors.textSecondary }]} selectable>{account.username ? `IG: @${account.username}` : 'IG username not available'}</Text><Text style={[styles.username, { color: colors.textSecondary }]} selectable>{account.x_username ? `X: @${account.x_username}` : 'X username not available'}</Text><Text style={[styles.username, { color: colors.textSecondary }]} selectable>{account.tiktok_username ? `TikTok: @${account.tiktok_username}` : 'TikTok username not available'}</Text>
          <View style={[styles.badge, { borderColor: statusColor }]} accessible accessibilityLabel={`Current status ${STATUS_LABELS[account.status]}`}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{STATUS_SYMBOLS[account.status]} {STATUS_LABELS[account.status].toUpperCase()}</Text>
          </View>
          {account.list_name ? <Text style={[styles.meta, { color: colors.textMuted }]}>List: {account.list_name}</Text> : null}
          {account.notes ? <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={2}>{account.notes}</Text> : null}
        </View>

        {(!(account.display_name || account.full_name) || !(account.profile_image_uri || account.image_url)) ? (
          <Pressable onPress={() => void refreshIdentity(true)} accessibilityRole='button' style={[styles.secondaryAction, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>Refresh profile info</Text>
          </Pressable>
        ) : null}

        {(account.profile_image_uri || account.local_image_path || account.image_url || account.profile_image_url) ? (
          <Pressable onPress={() => void saveToDevice()} disabled={busy} accessibilityRole='button' style={[styles.secondaryAction, { backgroundColor: colors.surfaceAlt, opacity: busy ? 0.6 : 1 }]}>
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>Download All Images</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={handleOpen} accessibilityRole='button' accessibilityLabel='Open Instagram profile' style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}><Text style={styles.primaryText}>Open Instagram</Text></Pressable>
        <Pressable onPress={handleOpenX} accessibilityRole='button' accessibilityLabel='Open X profile' style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}><Text style={styles.primaryText}>Open X</Text></Pressable><Pressable onPress={handleOpenTikTok} accessibilityRole='button' accessibilityLabel='Open TikTok profile' style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}><Text style={styles.primaryText}>Open TikTok</Text></Pressable>

        {account.source_url ? (
          <Pressable onPress={async () => { try { await Linking.openURL(account.source_url!); } catch { Alert.alert('Could not open source', 'The source link could not be opened.'); } }} accessibilityRole='link' accessibilityLabel='Open source link' style={[styles.secondaryAction, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.secondaryActionText, { color: colors.primary }]} numberOfLines={2}>Source: {account.source_url}</Text>
          </Pressable>
        ) : null}

        <Text style={[styles.section, { color: colors.textSecondary }]}>Account status</Text>
        <View style={styles.statusList}>
          {ACCOUNT_STATUSES.filter((s) => s !== AccountStatus.NEW).map((s) => (
            <StatusButton key={s} status={s} colors={colors} selected={account.status === s} disabled={busy} onPress={() => requestStatus(s)} />
          ))}
        </View>

        {notice ? <Text style={[styles.notice, { color: colors.textMuted }]} accessibilityLiveRegion='polite'>{notice}</Text> : null}

        <View style={styles.navRow}>
          <Pressable onPress={() => void guard(() => goPrevious(account.id))} disabled={busy} accessibilityRole='button' accessibilityLabel='Previous account' style={[styles.navButton, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.navText, { color: colors.text }]}>← Previous</Text>
          </Pressable>
          <Pressable onPress={() => void guard(() => goNext(account.id))} disabled={busy} accessibilityRole='button' accessibilityLabel='Next account' style={[styles.navButton, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.navText, { color: colors.text }]}>Next →</Text>
          </Pressable>
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Auto-next after status</Text>
          <Switch value={settings.autoNext} onValueChange={(value) => void update('autoNext', value)} accessibilityLabel='Auto-next after status' />
        </View>
      </>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Processing' }} />
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
      {undo ? <UndoBar colors={colors} message={`Status updated to ${undo.next.replace(/_/g, ' ')}`} onUndo={() => void handleUndo()} /> : null}
      <ConfirmDialog
        visible={pendingStatus !== null}
        colors={colors}
        title='Change status?'
        message={pendingStatus ? `Mark @${account?.username ?? ''} as ${STATUS_LABELS[pendingStatus]}?` : ''}
        confirmLabel='Confirm'
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => {
          const next = pendingStatus;
          setPendingStatus(null);
          if (next) void commitStatus(next);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, padding: 16, paddingBottom: 24, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 80 },
  centerText: { fontSize: 17, textAlign: 'center', lineHeight: 24 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '700' },
  accountBlock: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  avatarPlaceholder: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { fontSize: 28, fontWeight: '800' },
  displayName: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  username: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  badge: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '800' },
  meta: { fontSize: 13, textAlign: 'center' },
  primary: { minHeight: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  secondaryAction: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondaryActionText: { fontSize: 15, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  statusList: { gap: 10 },
  notice: { fontSize: 13, textAlign: 'center' },
  navRow: { flexDirection: 'row', gap: 12 },
  navButton: { flex: 1, minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 16, fontWeight: '700' },
  fileSwitcher:{borderWidth:1,borderRadius:12,padding:12,gap:3},fileSwitcherLabel:{fontSize:11,fontWeight:'700',textTransform:'uppercase'},fileSwitcherName:{fontSize:15,fontWeight:'800',paddingRight:52},fileSwitcherAction:{position:'absolute',right:12,top:18,fontWeight:'800'},modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.65)',justifyContent:'center',padding:18},fileModal:{borderWidth:1,borderRadius:18,padding:16,gap:10,maxHeight:'80%'},modalTitle:{fontSize:20,fontWeight:'800',marginBottom:4},fileOption:{borderWidth:1,borderRadius:12,padding:12,gap:4},cancelButton:{minHeight:48,borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:2},switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  switchLabel: { fontSize: 15, fontWeight: '600' },
});

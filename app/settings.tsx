import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { AccountStatus, ACCOUNT_STATUSES, STATUS_LABELS } from '../types/account';
import { toUserMessage } from '../services/errors';
import { createBackup, pickBackup, restoreBackup, type LoadedBackup } from '../services/backupService';
import type { AppSettings, ThemePreference } from '../services/settingsService';
import { APP_VERSION } from '../utils/constants';
import { formatDateHuman } from '../utils/normalization';
import { ThemeColors } from '../utils/theme';
import { useSettings } from '../utils/useSettings';
import { useTheme } from '../utils/useTheme';
import ConfirmDialog from '../components/ConfirmDialog';

function Section({ title, colors, children }: { title: string; colors: ThemeColors; children: React.ReactNode }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={[styles.section, { color: colors.textSecondary }]} accessibilityRole='header'>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function ToggleRow({ label, value, onChange, colors }: { label: string; value: boolean; onChange: (value: boolean) => void; colors: ThemeColors }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function Chips({ options, value, onSelect, colors }: { options: { key: string; label: string }[]; value: string; onSelect: (key: string) => void; colors: ThemeColors }) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole='button'
            accessibilityState={{ selected }}
            style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surfaceAlt, borderColor: selected ? colors.primary : colors.border }]}
          >
            <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionRow({ label, onPress, disabled, colors }: { label: string; onPress: () => void; disabled?: boolean; colors: ThemeColors }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.action, { backgroundColor: colors.surfaceAlt, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={[styles.actionText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const THEME_OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];
const FILTER_OPTIONS = [{ key: 'ALL', label: 'All' }, ...ACCOUNT_STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s] }))];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { settings, update } = useSettings();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<LoadedBackup | null>(null);

  const report = (text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  };

  const backup = async () => {
    setBusy(true);
    report('');
    try {
      const summary = await createBackup();
      report(`Backup created with ${summary.accounts.toLocaleString()} accounts and ${summary.lists.toLocaleString()} lists.`);
    } catch (e) {
      report(toUserMessage(e), true);
    } finally {
      setBusy(false);
    }
  };

  const chooseRestore = async () => {
    setBusy(true);
    report('');
    try {
      const loaded = await pickBackup();
      if (loaded) setPendingRestore(loaded);
    } catch (e) {
      report(toUserMessage(e), true);
    } finally {
      setBusy(false);
    }
  };

  const confirmRestore = async () => {
    const loaded = pendingRestore;
    setPendingRestore(null);
    if (!loaded) return;
    setBusy(true);
    try {
      await restoreBackup(loaded);
      report(`Restored ${loaded.summary.accounts.toLocaleString()} accounts and ${loaded.summary.lists.toLocaleString()} lists.`);
      router.replace('/');
    } catch (e) {
      report(toUserMessage(e), true);
    } finally {
      setBusy(false);
    }
  };

  const restoreDetails = pendingRestore
    ? `\n\nBackup: ${pendingRestore.summary.accounts.toLocaleString()} accounts, ${pendingRestore.summary.lists.toLocaleString()} lists${pendingRestore.summary.exportedAt ? `, saved ${formatDateHuman(pendingRestore.summary.exportedAt)}` : ''}.`
    : '';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Settings' }} />

      <Section title='Appearance' colors={colors}>
        <Chips options={THEME_OPTIONS} value={settings.theme} colors={colors} onSelect={(key) => void update('theme', key as ThemePreference)} />
      </Section>

      <Section title='Processing' colors={colors}>
        <ToggleRow label='Auto-next after status' value={settings.autoNext} colors={colors} onChange={(v) => void update('autoNext', v)} />
        <ToggleRow label='Confirm status changes' value={settings.confirmStatusChanges} colors={colors} onChange={(v) => void update('confirmStatusChanges', v)} />
        <Text style={[styles.rowLabel, { color: colors.text }]}>Default filter</Text>
        <Chips options={FILTER_OPTIONS} value={settings.defaultFilter} colors={colors} onSelect={(key) => void update('defaultFilter', key as AppSettings['defaultFilter'])} />
      </Section>

      <Section title='Instagram' colors={colors}>
        <ToggleRow label='Prefer Instagram app' value={settings.preferInstagramApp} colors={colors} onChange={(v) => void update('preferInstagramApp', v)} />
        <ToggleRow label='Browser fallback' value={settings.browserFallback} colors={colors} onChange={(v) => void update('browserFallback', v)} />
        <Text style={[styles.note, { color: colors.textMuted }]}>The app only opens profile links. You perform every action in Instagram yourself.</Text>
      </Section>

      <Section title='Data' colors={colors}>
        <ActionRow label='Export accounts' colors={colors} disabled={busy} onPress={() => router.push('/export')} />
        <ActionRow label='Backup database' colors={colors} disabled={busy} onPress={() => void backup()} />
        <ActionRow label='Restore database' colors={colors} disabled={busy} onPress={() => void chooseRestore()} />
        {message ? <Text style={[styles.note, { color: isError ? colors.danger : colors.textSecondary }]} accessibilityLiveRegion='polite'>{message}</Text> : null}
        <Text style={[styles.note, { color: colors.textMuted }]}>Your data is stored only on this device. Nothing is uploaded.</Text>
      </Section>

      <Section title='About' colors={colors}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>Version {APP_VERSION}</Text>
        <Text style={[styles.note, { color: colors.textMuted }]}>No account is needed. The app never asks for or stores Instagram credentials.</Text>
      </Section>

      <ConfirmDialog
        visible={pendingRestore !== null}
        colors={colors}
        title='WARNING'
        message={`Restoring this backup will replace your current local data.${restoreDetails}`}
        confirmLabel='Restore'
        destructive
        onConfirm={() => void confirmRestore()}
        onCancel={() => setPendingRestore(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, gap: 8 },
  sectionBlock: { gap: 8, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '700' },
  action: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 19 },
});

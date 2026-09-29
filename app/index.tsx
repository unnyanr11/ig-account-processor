import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { accountRepository, type StatusCounts } from '../database';
import { AccountStatus, ACCOUNT_STATUSES, STATUS_COLORS, STATUS_LABELS, STATUS_SYMBOLS } from '../types/account';
import { toUserMessage } from '../services/errors';
import { ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/useTheme';

interface Resume {
  id: number;
  position: number;
}

function StatRow({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  return (
    <View style={styles.statRow} accessible accessibilityLabel={`${label}: ${value.toLocaleString()}`}>
      <Text style={[styles.statLabel, { color, fontWeight: bold ? '800' : '600' }]}>{label}</Text>
      <Text style={[styles.statValue, { color, fontWeight: bold ? '800' : '700' }]}>{value.toLocaleString()}</Text>
    </View>
  );
}

function BigButton({ label, onPress, colors, primary }: { label: string; onPress: () => void; colors: ThemeColors; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.bigButton,
        { backgroundColor: primary ? colors.primary : colors.surface, borderColor: primary ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.bigButtonText, { color: primary ? '#FFFFFF' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [nextCounts, firstNew] = await Promise.all([
            accountRepository.getStatusCounts(),
            accountRepository.getFirstId({ status: AccountStatus.NEW }),
          ]);
          const position = firstNew === null ? 0 : await accountRepository.getPosition({}, firstNew);
          if (!active) return;
          setCounts(nextCounts);
          setResume(firstNew === null ? null : { id: firstNew, position });
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

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Instagram Queue' }} />

      {error ? <Text style={{ color: colors.danger, fontSize: 15 }}>{error}</Text> : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <StatRow label='Total Accounts' value={total} color={colors.text} bold />
        <StatRow label='Processed' value={processed} color={colors.text} />
        {ACCOUNT_STATUSES.map((status) => (
          <StatRow
            key={status}
            label={`${STATUS_SYMBOLS[status]}  ${STATUS_LABELS[status]}`}
            value={counts?.byStatus[status] ?? 0}
            color={STATUS_COLORS[status]}
          />
        ))}
      </View>

      {total === 0 && counts ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>No accounts yet. Import a file or paste usernames to get started.</Text>
      ) : null}

      {resume ? (
        <Pressable
          onPress={() => router.push({ pathname: '/queue', params: { startId: String(resume.id) } })}
          accessibilityRole='button'
          accessibilityLabel={`Continue from account ${resume.position}`}
          style={[styles.resume, { borderColor: colors.primary, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.resumeText, { color: colors.primary }]}>Continue from account {resume.position.toLocaleString()}</Text>
        </Pressable>
      ) : null}

      <BigButton label='Import Accounts' colors={colors} primary={total === 0} onPress={() => router.push('/import')} />
      <BigButton label='Continue Processing' colors={colors} primary={newCount > 0} onPress={() => router.push('/queue')} />
      <BigButton label='Lists' colors={colors} onPress={() => router.push('/lists')} />
      <BigButton label='Statistics' colors={colors} onPress={() => router.push('/statistics')} />
      <BigButton label='All Accounts' colors={colors} onPress={() => router.push('/accounts')} />
      <BigButton label='Import History' colors={colors} onPress={() => router.push('/history')} />
      <BigButton label='Settings' colors={colors} onPress={() => router.push('/settings')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontSize: 16 },
  statValue: { fontSize: 16 },
  hint: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  resume: { borderWidth: 2, borderRadius: 14, minHeight: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  resumeText: { fontSize: 17, fontWeight: '800' },
  bigButton: { borderWidth: 1, borderRadius: 14, minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  bigButtonText: { fontSize: 17, fontWeight: '700' },
});

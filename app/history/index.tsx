import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { historyRepository } from '../../database';
import type { ImportBatch } from '../../types/history';
import { toUserMessage } from '../../services/errors';
import { formatDateHuman } from '../../utils/normalization';
import { useTheme } from '../../utils/useTheme';
import EmptyState from '../../components/EmptyState';

export default function ImportHistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      historyRepository
        .getImportBatches()
        .then((rows) => {
          if (active) {
            setBatches(rows);
            setError('');
          }
        })
        .catch((e) => {
          if (active) setError(toUserMessage(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Import History' }} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size='large' color={colors.primary} accessibilityLabel='Loading' /></View>
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={error ? <Text style={{ color: colors.danger, fontSize: 15, marginBottom: 12 }}>{error}</Text> : null}
          ListEmptyComponent={<EmptyState colors={colors} title='No imports yet' message='Files and pasted lists you import will appear here.' />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/history/[id]', params: { id: String(item.id) } })}
              accessibilityRole='button'
              accessibilityLabel={`${item.file_name}, ${item.total_records} records, ${item.new_records} new`}
              style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{item.file_name}</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.total_records.toLocaleString()} records</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.new_records.toLocaleString()} new</Text>
              <Text style={[styles.date, { color: colors.textMuted }]}>{formatDateHuman(item.created_at)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  separator: { height: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 4 },
  name: { fontSize: 17, fontWeight: '800' },
  meta: { fontSize: 14 },
  date: { fontSize: 12, marginTop: 4 },
});

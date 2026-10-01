import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { accountRepository, type AccountFilters } from '../database';
import AccountCard from './AccountCard';
import EmptyState from './EmptyState';
import FilterBar, { type FilterOption } from './FilterBar';
import SearchBar from './SearchBar';
import { AccountStatus, ACCOUNT_STATUSES, STATUS_LABELS, type AccountWithList } from '../types/account';
import { useTheme } from '../utils/useTheme';
import { useDebouncedValue } from '../utils/useDebouncedValue';

const PAGE_SIZE = 100;

export type AccountBrowserProps = {
  baseFilters?: AccountFilters;
  header?: React.ReactNode;
};

export default function AccountBrowser({ baseFilters = {}, header }: AccountBrowserProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState<AccountWithList[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | AccountStatus>('ALL');
  const debouncedSearch = useDebouncedValue(search, 200);

  const filters = useMemo<AccountFilters>(() => ({
    ...baseFilters,
    search: debouncedSearch.trim() || undefined,
    status: status === 'ALL' ? baseFilters.status : status,
  }), [baseFilters, debouncedSearch, status]);

  const filterOptions = useMemo<FilterOption[]>(() => ([
    { key: 'ALL', label: 'All' },
    ...ACCOUNT_STATUSES.map((value) => ({ key: value, label: STATUS_LABELS[value] })),
  ]), []);

  const load = useCallback(async (reset: boolean, offset = 0) => {
    const nextOffset = reset ? 0 : offset;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const [rows, count] = await Promise.all([
        accountRepository.getPage(filters, PAGE_SIZE, nextOffset),
        accountRepository.count(filters),
      ]);
      setError('');
      setTotal(count);
      setAccounts((prev) => (reset ? rows : [...prev, ...rows]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load accounts.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  useEffect(() => {
    void load(true);
  }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={accounts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <AccountCard
            account={item}
            colors={colors}
            onPress={() => router.push({ pathname: '/account/[id]', params: { id: String(item.id) } })}
          />
        )}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        updateCellsBatchingPeriod={40}
        removeClippedSubviews={true}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (!loading && !loadingMore && accounts.length < total) void load(false, accounts.length);
        }}
        ListHeaderComponent={(
          <View style={styles.header}>
            {header}
            <SearchBar value={search} onChangeText={setSearch} colors={colors} />
            <FilterBar options={filterOptions} selectedKey={status} onSelect={(key) => setStatus(key as 'ALL' | AccountStatus)} colors={colors} />
            <Text style={[styles.datasetInfo, { color: colors.textMuted }]}>{accounts.length.toLocaleString()} of {total.toLocaleString()} accounts loaded</Text>
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          </View>
        )}
        ListEmptyComponent={loading ? null : <EmptyState colors={colors} title='No accounts found' message='Try a different search or filter.' />}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
      />
      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.primary} size='large' />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  header: { gap: 10, marginBottom: 2 },
  loader: { marginVertical: 14 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 14 },
  datasetInfo: { fontSize: 12, marginTop: -2 },
});

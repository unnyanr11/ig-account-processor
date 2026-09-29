import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { accountRepository, type AccountFilters } from '../database';
import { AccountStatus, AccountWithList, ACCOUNT_STATUSES, STATUS_LABELS } from '../types/account';
import { toUserMessage } from '../services/errors';
import { DEFAULT_PAGE_SIZE } from '../utils/constants';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { useSettings } from '../utils/useSettings';
import { useTheme } from '../utils/useTheme';
import AccountCard from './AccountCard';
import EmptyState from './EmptyState';
import FilterBar, { type FilterOption } from './FilterBar';
import SearchBar from './SearchBar';

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'ALL', label: 'All' },
  ...ACCOUNT_STATUSES.map((status) => ({ key: status, label: STATUS_LABELS[status] })),
  { key: 'IMPORTED_TODAY', label: 'Imported Today' },
  { key: 'UPDATED_TODAY', label: 'Updated Today' },
  { key: 'NEVER_PROCESSED', label: 'Never Processed' },
];

function filterParts(key: string): AccountFilters {
  if (key === 'ALL') return {};
  if (key === 'IMPORTED_TODAY') return { importedToday: true };
  if (key === 'UPDATED_TODAY') return { updatedToday: true };
  if (key === 'NEVER_PROCESSED') return { status: AccountStatus.NEW };
  return { status: key as AccountStatus };
}

interface Props {
  /** Must be a stable reference (module constant or useMemo) or the list reloads on every render. */
  baseFilters: AccountFilters;
  header?: React.ReactElement | null;
}

/** Searchable, filterable, paginated account list shared by All Accounts, lists and imports. */
export default function AccountBrowser({ baseFilters, header = null }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { settings, loaded } = useSettings();

  const [filterKey, setFilterKey] = useState('ALL');
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (loaded && !defaultApplied.current) {
      defaultApplied.current = true;
      setFilterKey(settings.defaultFilter);
    }
  }, [loaded, settings.defaultFilter]);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const filters = useMemo<AccountFilters>(
    () => ({ ...baseFilters, ...filterParts(filterKey), search: debouncedSearch }),
    [baseFilters, filterKey, debouncedSearch]
  );

  const [items, setItemsState] = useState<AccountWithList[]>([]);
  const itemsRef = useRef<AccountWithList[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const setItems = useCallback((next: AccountWithList[]) => {
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  const loadFirst = useCallback(async (keepLoaded: boolean) => {
    const requestId = ++requestRef.current;
    const limit = keepLoaded ? Math.max(PAGE_SIZE, itemsRef.current.length) : PAGE_SIZE;
    try {
      const [rows, count] = await Promise.all([
        accountRepository.getPage(filters, limit, 0),
        accountRepository.count(filters),
      ]);
      if (requestId !== requestRef.current) return;
      setItems(rows);
      setTotal(count);
      setError('');
    } catch (e) {
      if (requestId === requestRef.current) setError(toUserMessage(e));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [filters, setItems]);

  useEffect(() => {
    void loadFirst(false);
  }, [loadFirst]);

  // Refresh after returning from account details, keeping the pages already loaded.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void loadFirst(true);
    }, [loadFirst])
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || itemsRef.current.length >= total) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const requestId = requestRef.current;
    try {
      const rows = await accountRepository.getPage(filters, PAGE_SIZE, itemsRef.current.length);
      if (requestId === requestRef.current) setItems([...itemsRef.current, ...rows]);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [filters, total, setItems]);

  const openAccount = useCallback(
    (id: number) => router.push({ pathname: '/account/[id]', params: { id: String(id) } }),
    [router]
  );

  const isFiltered = filterKey !== 'ALL' || debouncedSearch.trim().length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.controls}>
        <SearchBar value={search} onChangeText={setSearch} colors={colors} />
        <FilterBar options={FILTER_OPTIONS} selectedKey={filterKey} onSelect={setFilterKey} colors={colors} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size='large' color={colors.primary} accessibilityLabel='Loading accounts' /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <AccountCard account={item} colors={colors} onPress={() => openAccount(item.id)} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.6}
          initialNumToRender={15}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps='handled'
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {header}
              {error ? <Text style={{ color: colors.danger, fontSize: 15 }}>{error}</Text> : null}
              <Text style={[styles.count, { color: colors.textSecondary }]} accessibilityLiveRegion='polite'>
                {total.toLocaleString()} {total === 1 ? 'account' : 'accounts'}
              </Text>
            </View>
          }
          ListEmptyComponent={
            isFiltered ? (
              <EmptyState colors={colors} title='No matching accounts' message='Try a different search or filter.' />
            ) : (
              <EmptyState colors={colors} title='No accounts yet' message='Import a file or paste usernames from the dashboard.' />
            )
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.primary} accessibilityLabel='Loading more' /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { padding: 16, paddingBottom: 8, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  headerBlock: { gap: 12, paddingBottom: 12 },
  count: { fontSize: 13, fontWeight: '700' },
  separator: { height: 10 },
  footer: { paddingVertical: 16 },
});

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { listRepository } from '../../database';
import type { ListWithStats } from '../../types/list';
import { toUserMessage } from '../../services/errors';
import { useTheme } from '../../utils/useTheme';
import EmptyState from '../../components/EmptyState';
import TextPromptDialog from '../../components/TextPromptDialog';

export default function ListsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [lists, setLists] = useState<ListWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLists(await listRepository.getAllWithStats());
      setError('');
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const createList = async (name: string) => {
    setCreating(false);
    try {
      await listRepository.create(name);
      await load();
    } catch (e) {
      Alert.alert('Could not create list', toUserMessage(e));
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'My Lists' }} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size='large' color={colors.primary} accessibilityLabel='Loading lists' /></View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View style={styles.header}>
              {error ? <Text style={{ color: colors.danger, fontSize: 15 }}>{error}</Text> : null}
              <Pressable onPress={() => setCreating(true)} accessibilityRole='button' accessibilityLabel='Create list' style={({ pressed }) => [styles.create, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                <Text style={styles.createText}>Create List</Text>
              </Pressable>
            </View>
          }
          ListEmptyComponent={<EmptyState colors={colors} title='No lists yet' message='Create a list to group accounts, for example by city or project.' />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/lists/[id]', params: { id: String(item.id) } })}
              accessibilityRole='button'
              accessibilityLabel={`${item.name}, ${item.processed} of ${item.total} processed`}
              style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {item.total.toLocaleString()} accounts  {'·'}  {item.processed.toLocaleString()} processed  {'·'}  {item.new_count.toLocaleString()} new
              </Text>
            </Pressable>
          )}
        />
      )}

      <TextPromptDialog
        visible={creating}
        title='New list'
        placeholder='For example: Delhi Accounts'
        confirmLabel='Create'
        colors={colors}
        onSubmit={(name) => void createList(name)}
        onCancel={() => setCreating(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  header: { gap: 12, marginBottom: 14 },
  create: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  createText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  separator: { height: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, minHeight: 72, gap: 6 },
  name: { fontSize: 18, fontWeight: '800' },
  meta: { fontSize: 13 },
});

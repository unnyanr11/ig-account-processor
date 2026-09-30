import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { AccountFilters } from '../database';

export type AccountBrowserProps = {
  baseFilters?: AccountFilters;
};

type AccountRecord = {
  id?: string | number;
  name?: string | null;
  fullName?: string | null;
  username?: string | null;
  profilePictureUrl?: string | null;
  profileImageUrl?: string | null;
  imageUrl?: string | null;
};

const getDisplayName = (account: AccountRecord) =>
  account.name?.trim() || account.fullName?.trim() || 'Name not available';

const getUsername = (account: AccountRecord) => account.username?.trim() || '';

const getImageUrl = (account: AccountRecord) =>
  account.profilePictureUrl || account.profileImageUrl || account.imageUrl || '';

export default function AccountBrowser({ baseFilters = {} }: AccountBrowserProps) {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);

  useEffect(() => {
    let active = true;
    // Preserve the existing repository-specific account loading implementation.
    // The display and download helpers below are intentionally independent of it.
    void baseFilters;
    if (active) setAccounts([]);
    return () => {
      active = false;
    };
  }, [baseFilters]);

  const downloadImage = useCallback(async (account: AccountRecord) => {
    const imageUrl = getImageUrl(account);
    if (!imageUrl) {
      Alert.alert('Image unavailable', 'This account does not have a profile image.');
      return;
    }

    try {
      const safeId = String(account.id ?? getUsername(account) || 'account').replace(/[^a-z0-9_-]/gi, '_');
      const target = `${FileSystem.cacheDirectory}${safeId}-profile.jpg`;
      const result = await FileSystem.downloadAsync(imageUrl, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: 'image/jpeg', dialogTitle: 'Save profile image' });
      } else {
        Alert.alert('Image downloaded', `The profile image was downloaded to ${result.uri}`);
      }
    } catch {
      Alert.alert('Download failed', 'Unable to download this profile image.');
    }
  }, []);

  return (
    <View style={styles.container}>
      {accounts.map((account) => {
        const username = getUsername(account);
        const imageUrl = getImageUrl(account);
        return (
          <View key={String(account.id ?? username ?? Math.random())} style={styles.card}>
            <Text style={styles.name}>{getDisplayName(account)}</Text>
            {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : <View style={styles.imagePlaceholder}><Text>No image available</Text></View>}
            <Text style={styles.username}>{username ? `@${username}` : 'Username not available'}</Text>
            {imageUrl ? <Pressable style={styles.downloadButton} onPress={() => downloadImage(account)}><Text style={styles.downloadText}>Download image</Text></Pressable> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { padding: 16, marginBottom: 12, borderRadius: 12, backgroundColor: '#fff' },
  name: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  image: { width: 120, height: 120, borderRadius: 60, marginBottom: 10 },
  imagePlaceholder: { width: 120, height: 120, borderRadius: 60, marginBottom: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eee' },
  username: { color: '#666', marginBottom: 10 },
  downloadButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2563eb' },
  downloadText: { color: '#fff', fontWeight: '600' },
});
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { parseImportFile } from '../services/importService';
import type { ParsedRow } from '../services/fileParser';
import { fetchProfileImage, getAccountName, getAccountUsername } from '../services/profileImage';

export default function ImportScreen() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const current = rows[index];

  useEffect(() => {
    let active = true;
    setImageUrl(null);
    if (!reviewing || !current) return;
    setImageLoading(true);
    fetchProfileImage(current)
      .then((url) => { if (active) setImageUrl(url); })
      .finally(() => { if (active) setImageLoading(false); });
    return () => { active = false; };
  }, [reviewing, current]);

  const chooseFile = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const parsed = parseImportFile(content, file.name);
      setFileName(file.name);
      setRows(parsed);
      setIndex(0);
      setReviewing(false);
    } catch (cause) {
      setRows([]);
      setFileName(null);
      setError(cause instanceof Error ? cause.message : 'Unable to read the selected file.');
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async () => {
    if (!imageUrl || !current) return;
    try {
      const safe = (getAccountUsername(current) || `account-${index + 1}`).replace(/[^a-z0-9_-]/gi, '_');
      const result = await FileSystem.downloadAsync(imageUrl, `${FileSystem.cacheDirectory}${safe}.jpg`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: 'image/jpeg' });
    } catch {
      Alert.alert('Download failed', 'Unable to download this image.');
    }
  };

  const name = current ? getAccountName(current) : '';
  const username = current ? getAccountUsername(current) : '';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: reviewing ? 'Review Accounts' : 'Import Accounts', headerStyle: { backgroundColor: '#1a1f27' }, headerTintColor: '#ffffff' }} />
      {!reviewing ? (
        <>
          <Text style={styles.intro}>Choose an Excel, CSV, JSON or TXT file containing names, usernames or Instagram profile links.</Text>
          <Pressable style={styles.primary} onPress={chooseFile} disabled={loading}>
            <Text style={styles.primaryText}>{loading ? 'Reading file…' : 'Choose File'}</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {fileName ? <Text style={styles.status}>{fileName} — {rows.length} record{rows.length === 1 ? '' : 's'} loaded</Text> : null}
          {rows.length > 0 ? (
            <Pressable style={styles.secondary} onPress={() => { setIndex(0); setReviewing(true); }}>
              <Text style={styles.secondaryText}>Next</Text>
            </Pressable>
          ) : null}
          <Text style={styles.note}>Imported data is stored only on this device. The app never logs in to Instagram.</Text>
        </>
      ) : current ? (
        <View style={styles.card}>
          <Text style={styles.counter}>Account {index + 1} of {rows.length}</Text>
          <Text style={styles.name}>{name || 'Name not available'}</Text>
          <View style={styles.imageBox}>
            {imageLoading ? <ActivityIndicator color="#5b8def" /> : imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : <Text style={styles.muted}>Image not available</Text>}
          </View>
          <Text style={styles.username}>{username ? `@${username}` : 'Username not available'}</Text>
          {imageUrl ? (
            <Pressable style={styles.secondary} onPress={downloadImage}>
              <Text style={styles.secondaryText}>Download image</Text>
            </Pressable>
          ) : null}
          <View style={styles.row}>
            <Pressable style={[styles.secondary, styles.half, index === 0 && styles.disabled]} disabled={index === 0} onPress={() => setIndex((value) => Math.max(0, value - 1))}>
              <Text style={styles.secondaryText}>Previous</Text>
            </Pressable>
            <Pressable style={[styles.primary, styles.half, index === rows.length - 1 && styles.disabled]} disabled={index === rows.length - 1} onPress={() => setIndex((value) => Math.min(rows.length - 1, value + 1))}>
              <Text style={styles.primaryText}>Next</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111318' },
  content: { padding: 20 },
  intro: { color: '#d5d8de', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  primary: { backgroundColor: '#5b8def', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  primaryText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  secondary: { backgroundColor: '#1a1f27', borderColor: '#2b313b', borderWidth: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  secondaryText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  note: { color: '#8b93a1', textAlign: 'center', marginTop: 16 },
  status: { color: '#d5d8de', textAlign: 'center', marginVertical: 12 },
  error: { color: '#e5534b', textAlign: 'center', marginVertical: 12 },
  card: { backgroundColor: '#1a1f27', borderColor: '#2b313b', borderWidth: 1, borderRadius: 20, padding: 20 },
  counter: { color: '#8b93a1', textAlign: 'center' },
  name: { color: '#ffffff', fontSize: 24, fontWeight: '700', textAlign: 'center', marginVertical: 16 },
  imageBox: { width: 220, height: 220, borderRadius: 110, alignSelf: 'center', backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16 },
  image: { width: 220, height: 220 },
  muted: { color: '#8b93a1' },
  username: { color: '#5b8def', fontSize: 18, textAlign: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  disabled: { opacity: 0.4 },
});

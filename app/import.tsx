import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, Button, Image, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseImportFile } from '../services/importService';
import type { ParsedRow } from '../services/fileParser';

const firstValue = (row: ParsedRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const getName = (row: ParsedRow) =>
  firstValue(row, ['name', 'fullName', 'full_name', 'displayName', 'display_name']) || 'Name not available';

const getImageUrl = (row: ParsedRow) =>
  firstValue(row, ['profilePictureUrl', 'profileImageUrl', 'imageUrl', 'profile_pic_url', 'profile_image_url', 'avatar', 'picture']);

export default function ImportScreen() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*', 'text/csv', 'text/comma-separated-values', 'application/csv', 'application/json', 'text/json', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const parsedRows = parseImportFile(content, file.name);
      setSelectedName(file.name);
      setRows(parsedRows);
      setCurrentIndex(0);
      setReviewing(false);
    } catch (cause) {
      setRows([]);
      setSelectedName(null);
      setError(cause instanceof Error ? cause.message : 'Unable to read the selected file.');
    } finally {
      setLoading(false);
    }
  };

  const currentAccount = rows[currentIndex];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: reviewing ? 'Review Accounts' : 'Import Accounts' }} />
      {!reviewing ? (
        <>
          <Text style={styles.title}>Import accounts</Text>
          <Text style={styles.description}>Choose a JSON, CSV, or Excel file to preview its records.</Text>
          <Button title={loading ? 'Reading file…' : 'Select JSON, CSV, or Excel file'} onPress={pickFile} disabled={loading} />
          {loading ? <ActivityIndicator style={styles.progress} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {selectedName ? <Text style={styles.fileName}>{selectedName} — {rows.length} record{rows.length === 1 ? '' : 's'}</Text> : null}
          {rows.length > 0 ? <View style={styles.nextButton}><Button title="Next" onPress={() => { setCurrentIndex(0); setReviewing(true); }} /></View> : null}
          {rows.length === 0 && selectedName && !loading ? <Text style={styles.empty}>No records found in this file.</Text> : null}
        </>
      ) : currentAccount ? (
        <>
          <Text style={styles.title}>Account {currentIndex + 1} of {rows.length}</Text>
          <Text style={styles.name}>{getName(currentAccount)}</Text>
          {getImageUrl(currentAccount) ? <Image source={{ uri: getImageUrl(currentAccount) }} style={styles.image} /> : <View style={styles.placeholder}><Text>Image not available</Text></View>}
          <View style={styles.navigation}>
            <Button title="Previous" onPress={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0} />
            <Button title={currentIndex === rows.length - 1 ? 'Done' : 'Next'} onPress={() => setCurrentIndex((index) => Math.min(rows.length - 1, index + 1))} disabled={currentIndex === rows.length - 1} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  description: { marginBottom: 16, color: '#666' },
  progress: { margin: 16 },
  error: { color: '#b00020', marginTop: 16 },
  fileName: { marginTop: 16, fontWeight: '600' },
  nextButton: { marginTop: 20 },
  empty: { marginTop: 16, color: '#666' },
  name: { fontSize: 24, fontWeight: '700', marginVertical: 20 },
  image: { width: 240, height: 240, borderRadius: 120, alignSelf: 'center', marginBottom: 24 },
  placeholder: { width: 240, height: 240, borderRadius: 120, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eee', marginBottom: 24 },
  navigation: { flexDirection: 'row', justifyContent: 'space-between' },
});

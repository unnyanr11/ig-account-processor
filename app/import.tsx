import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseImportFile } from '../services/importService';
import type { ParsedRow } from '../services/fileParser';

export default function ImportScreen() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
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
    } catch (cause) {
      setRows([]);
      setSelectedName(null);
      setError(cause instanceof Error ? cause.message : 'Unable to read the selected file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Import Accounts' }} />
      <Text style={styles.title}>Import accounts</Text>
      <Text style={styles.description}>Choose a JSON, CSV, or Excel file to preview its records.</Text>
      <Button title={loading ? 'Reading file…' : 'Select JSON, CSV, or Excel file'} onPress={pickFile} disabled={loading} />
      {loading ? <ActivityIndicator style={styles.progress} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {selectedName ? <Text style={styles.fileName}>{selectedName} — {rows.length} record{rows.length === 1 ? '' : 's'}</Text> : null}
      {rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(_, index) => String(index)}
          style={styles.list}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>Record {index + 1}</Text>
              <Text numberOfLines={3}>{JSON.stringify(item)}</Text>
            </View>
          )}
        />
      ) : selectedName && !loading ? <Text style={styles.empty}>No records found in this file.</Text> : null}
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
  list: { marginTop: 12 },
  row: { padding: 12, marginBottom: 8, borderRadius: 8, backgroundColor: '#f2f2f2' },
  rowTitle: { fontWeight: '700', marginBottom: 4 },
  empty: { marginTop: 16, color: '#666' },
});

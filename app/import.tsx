import React, { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { accountRepository, historyRepository } from '../database';
import { analyzeImport, type ImportAnalysis } from '../services/importService';
import { AccountStatus } from '../types/account';

export default function ImportScreen() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(0);

  const chooseFile = async () => {
    setError(''); setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      setFileName(file.name);
      setAnalysis(await analyzeImport(content, file.name, accountRepository.findExistingUsernames));
      setComplete(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to read the selected file.'); }
    finally { setLoading(false); }
  };

  const importAccounts = async () => {
    if (!analysis) return;
    setImporting(true); setError('');
    try {
      const inserted = await accountRepository.insertMany(analysis.validRecords.map((record) => ({ username: record.username, instagram_url: record.instagramUrl, display_name: record.displayName, image_url: record.imageUrl, source: fileName, list_id: null })));
      const ids = Array.from(inserted.values());
      const existingIds = await accountRepository.getIdsByUsernames(analysis.validRecords.map((record) => record.username));
      const batchId = await historyRepository.createImportBatch(fileName, { total: analysis.total, newRecords: analysis.newRecords, duplicates: analysis.duplicates, invalid: analysis.invalid });
      await historyRepository.linkAccountsToBatch(batchId, Array.from(new Set([...ids, ...existingIds])));
      setAdded(inserted.size); setComplete(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to import accounts.'); }
    finally { setImporting(false); }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Import Accounts', headerStyle: { backgroundColor: '#1a1f27' }, headerTintColor: '#fff' }} />
      {complete ? (
        <View style={styles.complete}>
          <Text style={styles.completeTitle}>Import complete</Text>
          <Text style={styles.subtitle}>{added} new accounts were added.</Text>
          <Pressable style={styles.primary} onPress={() => router.push('/queue')}><Text style={styles.primaryText}>Start Processing</Text></Pressable>
          <Pressable style={styles.secondary} onPress={chooseFile}><Text style={styles.secondaryText}>Import Another File</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => router.replace('/')}><Text style={styles.secondaryText}>Back to Dashboard</Text></Pressable>
        </View>
      ) : analysis ? (
        <>
          <Text style={styles.heading}>Import Preview</Text>
          <Text style={styles.file}>{fileName}</Text>
          <View style={styles.card}>
            <Metric label="Records detected" value={analysis.total} />
            <Metric label="New accounts" value={analysis.newRecords} accent />
            <Metric label="Already in database" value={analysis.existingRecords} />
            <Metric label="Duplicates in file" value={analysis.duplicates} />
            <Metric label="Invalid entries" value={analysis.invalid} />
          </View>
          <View style={styles.card}>{analysis.validRecords.slice(0, 50).map((record) => <Text key={record.username} style={styles.username}>@{record.username}</Text>)}</View>
          <View style={styles.row}><Pressable style={[styles.secondary, styles.half]} onPress={() => setAnalysis(null)}><Text style={styles.secondaryText}>Cancel</Text></Pressable><Pressable style={[styles.primary, styles.half]} onPress={() => void importAccounts()} disabled={importing}><Text style={styles.primaryText}>{importing ? 'Importing…' : `Import ${analysis.newRecords} Accounts`}</Text></Pressable></View>
        </>
      ) : (
        <View>
          <Text style={styles.intro}>Choose an Excel, CSV, JSON or TXT file, or paste usernames.</Text>
          <Pressable style={styles.primary} onPress={() => void chooseFile()} disabled={loading}><Text style={styles.primaryText}>{loading ? 'Reading…' : 'Choose File'}</Text></Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.note}>Imported usernames are stored only on this device. Nothing is uploaded, and the app never logs in to Instagram.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) { return <View style={styles.metric}><Text style={[styles.metricLabel, accent && styles.accent]}>{label}</Text><Text style={[styles.metricValue, accent && styles.accent]}>{value}</Text></View>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#111318' }, content: { flexGrow: 1, padding: 20 }, intro: { color: '#d5d8de', fontSize: 17, textAlign: 'center', marginVertical: 24 }, heading: { color: '#fff', fontSize: 34, fontWeight: '800', marginBottom: 14 }, file: { color: '#aeb5c0', fontSize: 20, marginBottom: 20 }, card: { backgroundColor: '#1a1f27', borderColor: '#2b313b', borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 20 }, metric: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }, metricLabel: { color: '#c3c8d0', fontSize: 20, fontWeight: '600' }, metricValue: { color: '#fff', fontSize: 22, fontWeight: '800' }, accent: { color: '#5b8def' }, username: { color: '#e5e7eb', fontSize: 20, marginBottom: 16 }, primary: { flex: 1, backgroundColor: '#5b8def', borderRadius: 16, minHeight: 64, alignItems: 'center', justifyContent: 'center', padding: 16, marginBottom: 12 }, primaryText: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' }, secondary: { flex: 1, backgroundColor: '#1a1f27', borderColor: '#2b313b', borderWidth: 1, borderRadius: 16, minHeight: 64, alignItems: 'center', justifyContent: 'center', padding: 16, marginBottom: 12 }, secondaryText: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' }, complete: { marginTop: 180, alignItems: 'center' }, completeTitle: { color: '#fff', fontSize: 32, fontWeight: '800', marginBottom: 20 }, subtitle: { color: '#c3c8d0', fontSize: 20, marginBottom: 28 }, row: { flexDirection: 'row', gap: 12 }, half: { minHeight: 92 }, note: { color: '#8b93a1', textAlign: 'center', marginTop: 24, fontSize: 15 }, error: { color: '#e5534b', textAlign: 'center', margin: 16 },});

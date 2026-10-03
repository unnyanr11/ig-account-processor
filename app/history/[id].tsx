import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { historyRepository, type AccountFilters } from '../../database';
import type { ImportBatch } from '../../types/history';
import { formatDateHuman } from '../../utils/normalization';
import { useTheme } from '../../utils/useTheme';
import AccountBrowser from '../../components/AccountBrowser';

export default function ImportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const batchId = Number(id);
  const router = useRouter();
  const { colors } = useTheme();
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [missing, setMissing] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const baseFilters = useMemo<AccountFilters>(() => ({ importBatchId: batchId }), [batchId]);

  useEffect(() => {
    historyRepository
      .getImportBatch(batchId)
      .then((found) => (found ? setBatch(found) : setMissing(true)))
      .catch(() => setMissing(true));
  }, [batchId]);

  if (missing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Import' }} />
        <Text style={[styles.body, { color: colors.text }]}>This import could not be found.</Text>
      </View>
    );
  }

  const header = batch ? (
    <View style={styles.header}>
      <Text style={[styles.name, { color: colors.text }]} accessibilityRole='header'>{batch.file_name}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>{formatDateHuman(batch.created_at)}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        {batch.total_records.toLocaleString()} records  {'·'}  {batch.new_records.toLocaleString()} new  {'·'}  {batch.duplicate_records.toLocaleString()} duplicates  {'·'}  {batch.invalid_records.toLocaleString()} invalid
      </Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        The list below includes accounts that were already in the app when this file was imported.
      </Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        Undo restores affected existing accounts to their pre-import state and removes accounts created by this import. Later changes to affected accounts may be reverted.
      </Text>
      <Pressable onPress={()=>router.push({pathname:'/queue',params:{importId:String(batchId)}})} style={[styles.process,{backgroundColor:colors.primary}]} accessibilityRole='button'><Text style={styles.processText}>Process This File</Text></Pressable>\n      <Pressable disabled={undoing} onPress={()=>{
        Alert.alert('Undo entire import?','This restores affected existing accounts and removes accounts created by this import.',[
          {text:'Cancel',style:'cancel'},
          {text:'Undo Import',style:'destructive',onPress:async()=>{
            setUndoing(true);
            try{
              const result=await historyRepository.undoImportBatch(batchId);
              Alert.alert('Import undone',result.removed.toLocaleString()+' created accounts removed. '+result.restored.toLocaleString()+' existing accounts restored.'+(result.skipped?' '+result.skipped.toLocaleString()+' accounts skipped.':''));
              router.back();
            }catch(e){Alert.alert('Undo failed',e instanceof Error?e.message:'The import could not be undone.');}
            finally{setUndoing(false);}
          }}
        ]);
      }} style={[styles.undo,{borderColor:colors.danger,backgroundColor:colors.surface,opacity:undoing?.6:1}]}>
        {undoing?<ActivityIndicator color={colors.danger}/>:<Text style={{color:colors.danger,fontWeight:'800'}}>Undo Entire Import</Text>}
      </Pressable>
    </View>
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: batch?.file_name ?? 'Import' }} />
      <AccountBrowser baseFilters={baseFilters} header={header} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  body: { fontSize: 16, textAlign: 'center' },
  header: { gap: 6 },
  process: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  processText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800' },
  meta: { fontSize: 14 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  undo: { borderWidth: 1, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
});

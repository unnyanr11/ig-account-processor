import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useRouter } from 'expo-router';
import { listRepository } from '../database';
import type { List } from '../types/list';
import { toUserMessage } from '../services/errors';
import { parseImportFile, parsePastedText, type ParsedImport } from '../services/fileParser';
import { buildImportPlan, commitImport, type ImportPlan, type ImportSummary } from '../services/importService';
import { formatDateHuman, nowIso } from '../utils/normalization';
import { ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/useTheme';
import ImportPreview from '../components/ImportPreview';
import ProgressBar from '../components/ProgressBar';

type Step = 'idle' | 'working' | 'preview' | 'importing' | 'done';

function ActionButton({ label, onPress, colors, primary, disabled }: { label: string; onPress: () => void; colors: ThemeColors; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? colors.primary : colors.surface, borderColor: primary ? colors.primary : colors.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? '#FFFFFF' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function ImportScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [step, setStep] = useState<Step>('idle');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const planRef = useRef<ImportPlan | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [lists, setLists] = useState<List[]>([]);
  const [listId, setListId] = useState<number | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [insertedCount, setInsertedCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    listRepository.getAll().then(setLists).catch(() => setLists([]));
  }, []);

  const prepare = async (source: string, parse: () => Promise<ParsedImport> | ParsedImport) => {
    setError('');
    setStep('working');
    try {
      const parsed = await parse();
      const plan = await buildImportPlan(source, parsed.entries);
      planRef.current = plan;
      setSummary(plan.summary);
      setStep('preview');
    } catch (e) {
      setError(toUserMessage(e));
      setStep('idle');
    }
  };

  const chooseFile = async () => {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      // MIME filters are unreliable for spreadsheets on Android, so the file type is checked after picking.
      result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    } catch {
      setError('The file picker could not be opened. Please try again.');
      return;
    }
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await prepare(asset.name, () => parseImportFile(asset.uri, asset.name));
  };

  const previewPaste = async () => {
    await prepare(`Pasted text (${formatDateHuman(nowIso())})`, () => parsePastedText(pasteText));
  };

  const cancel = () => {
    planRef.current = null;
    setSummary(null);
    setStep('idle');
  };

  const startImport = async () => {
    const plan = planRef.current;
    if (!plan) return;
    setError('');
    setProgress({ done: 0, total: plan.newUsernames.length });
    setStep('importing');
    try {
      const result = await commitImport(plan, { listId, onProgress: (done, total) => setProgress({ done, total }) });
      setInsertedCount(result.insertedCount);
      planRef.current = null;
      setStep('done');
    } catch (e) {
      setError(`${toUserMessage(e)} Some accounts may already have been saved. Importing the same file again will not create duplicates.`);
      setStep('preview');
    }
  };

  let body: React.ReactNode;

  if (step === 'working') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size='large' color={colors.primary} accessibilityLabel='Reading file' />
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>Reading and checking usernames...</Text>
      </View>
    );
  } else if (step === 'importing') {
    body = (
      <View style={styles.center}>
        <Text style={[styles.heading, { color: colors.text }]} accessibilityLiveRegion='polite'>Importing...</Text>
        <ProgressBar current={progress.done} total={progress.total} colors={colors} />
      </View>
    );
  } else if (step === 'done') {
    body = (
      <View style={styles.center}>
        <Text style={[styles.heading, { color: colors.text }]}>Import complete</Text>
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>{insertedCount.toLocaleString()} new accounts were added.</Text>
        <ActionButton label='Start Processing' primary colors={colors} onPress={() => router.replace('/queue')} />
        <ActionButton label='Import Another File' colors={colors} onPress={() => { setSummary(null); setPasteText(''); setPasteOpen(false); setStep('idle'); }} />
        <ActionButton label='Back to Dashboard' colors={colors} onPress={() => router.replace('/')} />
      </View>
    );
  } else if (step === 'preview' && summary) {
    body = (
      <View style={styles.section}>
        <ImportPreview summary={summary} colors={colors} />
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {summary.newCount === 0 ? (
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>There are no new accounts to import from this source.</Text>
        ) : null}
        <View style={styles.row}>
          <View style={styles.flex}><ActionButton label='Cancel' colors={colors} onPress={cancel} /></View>
          {summary.newCount > 0 ? (
            <View style={styles.flex}>
              <ActionButton label={`Import ${summary.newCount.toLocaleString()} Accounts`} primary colors={colors} onPress={() => void startImport()} />
            </View>
          ) : null}
        </View>
      </View>
    );
  } else {
    body = (
      <View style={styles.section}>
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>
          Choose an Excel, CSV or TXT file, or paste usernames, @usernames or Instagram profile links.
        </Text>

        {error ? <Text style={[styles.error, { color: colors.danger }]} accessibilityLiveRegion='polite'>{error}</Text> : null}

        {lists.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Add new accounts to a list</Text>
            <View style={styles.chips}>
              {[{ id: null as number | null, name: 'No list' }, ...lists].map((item) => {
                const selected = listId === item.id;
                return (
                  <Pressable
                    key={item.id ?? 'none'}
                    onPress={() => setListId(item.id)}
                    accessibilityRole='button'
                    accessibilityState={{ selected }}
                    style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surfaceAlt, borderColor: selected ? colors.primary : colors.border }]}
                  >
                    <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>{item.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <ActionButton label='Choose File' primary colors={colors} onPress={() => void chooseFile()} />
        <ActionButton label={pasteOpen ? 'Hide Paste Box' : 'Paste Usernames'} colors={colors} onPress={() => setPasteOpen((open) => !open)} />

        {pasteOpen ? (
          <View style={styles.section}>
            <TextInput
              value={pasteText}
              onChangeText={setPasteText}
              multiline
              placeholder='Paste usernames, @usernames or links here'
              placeholderTextColor={colors.textMuted}
              accessibilityLabel='Pasted usernames'
              autoCapitalize='none'
              autoCorrect={false}
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
            <ActionButton label='Preview Import' primary colors={colors} disabled={!pasteText.trim()} onPress={() => void previewPaste()} />
          </View>
        ) : null}

        <Text style={[styles.privacy, { color: colors.textMuted }]}>
          Imported usernames are stored only on this device. Nothing is uploaded, and the app never logs in to Instagram.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
      <Stack.Screen options={{ title: 'Import Accounts' }} />
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  section: { gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 60 },
  centerText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  heading: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  error: { fontSize: 15, lineHeight: 22 },
  privacy: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  button: { borderWidth: 1, borderRadius: 14, minHeight: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 14, minHeight: 160, padding: 14, fontSize: 15, textAlignVertical: 'top' },
});

import React from 'react';
import { Stack } from 'expo-router';
import { Alert, Button, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseImportFile } from '../services/importService';

export default function ImportScreen() {
  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    try {
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const rows = parseImportFile(content, file.name);
      Alert.alert('File read successfully', `${rows.length} account record${rows.length === 1 ? '' : 's'} found.`);
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Unable to read the selected file.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Stack.Screen options={{ title: 'Import Accounts' }} />
      <Button title="Select JSON, CSV, or Excel file" onPress={pickFile} />
    </View>
  );
}

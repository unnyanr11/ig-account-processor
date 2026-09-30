import React from 'react';
import { Text, View } from 'react-native';
import type { ImportSummary } from '../services/importService';

type ImportPreviewProps = {
  summary: ImportSummary;
};

export default function ImportPreview({ summary }: ImportPreviewProps) {
  const shown: string[] = summary.names ?? [];

  return (
    <View>
      <Text>{summary.total} records found</Text>
      {shown.map((name: string) => (
        <Text key={name}>{name}</Text>
      ))}
    </View>
  );
}

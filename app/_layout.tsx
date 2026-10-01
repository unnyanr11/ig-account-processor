import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDb } from '../database';
import Onboarding from '../components/Onboarding';
import { useSettings } from '../utils/useSettings';
import { useTheme } from '../utils/useTheme';

type DbState = 'loading' | 'ready' | 'error';

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  const { settings, loaded, update } = useSettings();
  const [dbState, setDbState] = useState<DbState>('loading');

  useEffect(() => {
    getDb().then(() => setDbState('ready')).catch(() => setDbState('error'));
  }, []);

  const statusBar = <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;

  if (!loaded || dbState === 'loading') {
    return <View style={{ flex: 1, backgroundColor: colors.background }}>{statusBar}</View>;
  }

  if (dbState === 'error') {
    return (
      <View style={[styles.fatal, { backgroundColor: colors.background }]}>
        {statusBar}
        <Text style={[styles.fatalTitle, { color: colors.text }]}>Database unavailable</Text>
        <Text style={[styles.fatalText, { color: colors.textSecondary }]}>
          The local database could not be opened. You can continue to the app and retry the operation.
        </Text>
        <Text style={[styles.fatalText, { color: colors.textMuted }]}>
          Close and reopen the app after installing the latest build if this message persists.
        </Text>
      </View>
    );
  }

  if (!settings.onboardingComplete) {
    return (
      <>
        {statusBar}
        <Onboarding colors={colors} onDone={() => void update('onboardingComplete', true)} />
      </>
    );
  }

  return (
    <>
      {statusBar}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fatal: { flex: 1, padding: 28, justifyContent: 'center', gap: 12 },
  fatalTitle: { fontSize: 24, fontWeight: '800' },
  fatalText: { fontSize: 16, lineHeight: 23 },
});

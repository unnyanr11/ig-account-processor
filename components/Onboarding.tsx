import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../utils/theme';

interface Props {
  colors: ThemeColors;
  onDone: () => void;
}

export default function Onboarding({ colors, onDone }: Props) {
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole='header'>Welcome</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Import Instagram usernames from Excel, CSV or TXT files.
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Process accounts one by one, open profiles in Instagram, and track your progress.
      </Text>
      <Text style={[styles.privacy, { color: colors.textMuted }]}>
        Everything stays on this device. No sign-up or Instagram login is needed, and the app never follows, messages or acts on Instagram for you. You do every action yourself.
      </Text>
      <Pressable
        onPress={onDone}
        accessibilityRole='button'
        accessibilityLabel='Get started'
        style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 28, justifyContent: 'center', gap: 16 },
  title: { fontSize: 36, fontWeight: '800' },
  body: { fontSize: 18, lineHeight: 26 },
  privacy: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  button: { minHeight: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});

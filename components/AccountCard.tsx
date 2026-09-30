import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccountWithList, STATUS_COLORS, STATUS_LABELS, STATUS_SYMBOLS } from '../types/account';
import { formatDateHuman } from '../utils/normalization';
import { ThemeColors } from '../utils/theme';

interface Props {
  account: AccountWithList;
  colors: ThemeColors;
  onPress: () => void;
}

function AccountCard({ account, colors, onPress }: Props) {
  const color = STATUS_COLORS[account.status];
  const label = STATUS_LABELS[account.status];
  const meta = `${account.list_name ? account.list_name + '  ·  ' : ''}${formatDateHuman(account.updated_at)}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={`${account.username}, status ${label}. Open details`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.top}>
        {(account.profile_image_uri || account.image_url) ? (
          <Image source={{ uri: account.profile_image_uri || account.image_url || undefined }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.avatarPlaceholderText, { color: colors.textMuted }]}>{(account.username[0] || '?').toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>{account.display_name || account.full_name || 'Instagram account'}</Text>
          <Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>@{account.username}</Text>
        </View>
        <View style={[styles.badge, { borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{STATUS_SYMBOLS[account.status]} {label}</Text>
        </View>
      </View>
      <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>{meta}</Text>
      {account.notes ? <Text style={[styles.notes, { color: colors.textSecondary }]} numberOfLines={1}>{account.notes}</Text> : null}
    </Pressable>
  );
}

export default React.memo(AccountCard);

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 64, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { fontSize: 18, fontWeight: '800' },
  identity: { flex: 1, gap: 2 },
  displayName: { flexShrink: 1, fontSize: 16, fontWeight: '800' },
  username: { flexShrink: 1, fontSize: 14, fontWeight: '600' },
  badge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  meta: { fontSize: 12 },
  notes: { fontSize: 13 },
});

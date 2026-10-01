import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccountWithList, STATUS_COLORS, STATUS_LABELS, STATUS_SYMBOLS } from '../types/account';
import { formatDateHuman } from '../utils/normalization';
import { ThemeColors } from '../utils/theme';
import FullScreenImage from './FullScreenImage';

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
      accessibilityLabel={`${account.model_name || 'Model'}, ${account.username ? `Instagram @${account.username}` : 'IG username not available'}, ${account.x_username ? `X @${account.x_username}` : 'X username not available'}, ${account.tiktok_username ? `TikTok @${account.tiktok_username}` : 'TikTok username not available'}, status ${label}. Open details`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.top}>
        {(account.profile_image_uri || account.local_image_path || account.image_url || account.profile_image_url) ? (
          <FullScreenImage uri={account.profile_image_uri || account.local_image_path || account.image_url || account.profile_image_url} size={50} textColor={colors.text} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.avatarPlaceholderText, { color: colors.textMuted }]}>{(account.username?.[0] || account.model_name?.[0] || '?').toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>{account.model_name || account.display_name || account.full_name || 'Unnamed model'}</Text>
          <Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>{account.username ? `IG: @${account.username}` : 'IG username not available'}</Text><Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>{account.x_username ? `X: @${account.x_username}` : 'X username not available'}</Text><Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>{account.tiktok_username ? `TikTok: @${account.tiktok_username}` : 'TikTok username not available'}</Text>
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

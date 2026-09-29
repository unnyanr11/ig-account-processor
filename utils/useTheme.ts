import { useColorScheme } from 'react-native';
import { getColors, ThemeColors } from './theme';
import { useSettings } from './useSettings';

/** Resolves the Appearance setting (System / Light / Dark) into a color palette. */
export function useTheme(): { colors: ThemeColors; scheme: 'light' | 'dark' } {
  const system = useColorScheme();
  const { settings } = useSettings();
  const scheme: 'light' | 'dark' =
    settings.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.theme;
  return { colors: getColors(scheme), scheme };
}

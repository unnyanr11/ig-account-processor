export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  danger: string;
}

export const lightColors: ThemeColors = {
  background: '#F5F6F8', surface: '#FFFFFF', surfaceAlt: '#EEF0F3', border: '#E1E4E8',
  text: '#14171A', textSecondary: '#4A4F57', textMuted: '#6B7078',
  primary: '#2F6FE4', danger: '#D13B3A',
};

export const darkColors: ThemeColors = {
  background: '#0F1115', surface: '#1A1D23', surfaceAlt: '#22262E', border: '#2B2F38',
  text: '#F2F3F5', textSecondary: '#C2C6CC', textMuted: '#9AA0A8',
  primary: '#5B8DEF', danger: '#FF6B6B',
};

export function getColors(scheme: 'light' | 'dark'): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

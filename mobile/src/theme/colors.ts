const palette = {
  royalBlue: '#2563EB',
  skyBlue: '#3B82F6',
  royalBlueDark: '#1D4ED8',
  emerald: '#10B981',
  slateDark: '#0F172A',
  white: '#FFFFFF',
  black: '#000000',
  textPrimaryLight: '#111827',
  textSecondaryLight: '#6B7280',
  textDisabledLight: '#9CA3AF',
  surfaceLight: '#F8FAFC',
  borderLight: '#E5E7EB',
  dividerLight: '#E5E7EB',
  error: '#EF4444',
  warning: '#F59E0B',
  slate800: '#1E293B',
  slate700: '#334155',
  textPrimaryDark: '#F9FAFB',
  textSecondaryDark: '#9CA3AF',
  textDisabledDark: '#6B7280',
  surfaceDark: '#1E293B',
  cardDark: '#1E293B',
  borderDark: '#334155',
  dividerDark: '#334155',
} as const;

const shared = {
  primary: palette.royalBlue,
  primaryLight: palette.skyBlue,
  primaryDark: palette.royalBlueDark,
  accent: palette.emerald,
  success: palette.emerald,
  warning: palette.warning,
  error: palette.error,
  info: palette.skyBlue,
  white: palette.white,
  black: palette.black,
} as const;

export const colors = {
  light: {
    ...shared,
    background: palette.white,
    surface: palette.surfaceLight,
    card: palette.white,
    border: palette.borderLight,
    divider: palette.dividerLight,
    overlay: 'rgba(15, 23, 42, 0.5)',
    textPrimary: palette.textPrimaryLight,
    textSecondary: palette.textSecondaryLight,
    textDisabled: palette.textDisabledLight,
  },
  dark: {
    ...shared,
    background: palette.slateDark,
    surface: palette.surfaceDark,
    card: palette.cardDark,
    border: palette.borderDark,
    divider: palette.dividerDark,
    overlay: 'rgba(0, 0, 0, 0.6)',
    textPrimary: palette.textPrimaryDark,
    textSecondary: palette.textSecondaryDark,
    textDisabled: palette.textDisabledDark,
  },
} as const;

export type ThemeMode = keyof typeof colors;
export type ColorTokenKey = keyof (typeof colors)['light'];
export type ColorTokens = (typeof colors)[ThemeMode];

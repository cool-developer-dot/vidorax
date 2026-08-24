import { useMemo } from 'react';

import { useTheme } from '@/hooks/use-theme';
import {
  colors,
  elevation,
  radius,
  spacing,
  typography,
  type Theme,
} from '@/theme';

/**
 * Profile visual tokens — theme-aware (Light / Dark).
 */
export type ProfileTokens = ReturnType<typeof createProfileTokens>;
export type StatusBadgeTone =
  | 'verified'
  | 'unverified'
  | 'suspended'
  | 'pending'
  | 'admin'
  | 'comingSoon';

export function createProfileTokens(theme: Theme) {
  const isDark = theme.colors.background === colors.dark.background;
  const c = theme.colors;

  return {
    background: isDark ? c.background : '#F3F5F8',
    card: c.card,
    cardBorder: isDark ? 'rgba(248, 250, 252, 0.08)' : 'rgba(15, 23, 42, 0.06)',
    heroWashTop: isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(37, 99, 235, 0.09)',
    heroWashBottom: isDark ? 'rgba(15, 23, 42, 0)' : 'rgba(243, 245, 248, 0)',
    avatarRing: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    avatarGradientStart: c.primaryLight,
    avatarGradientMid: c.primary,
    avatarGradientEnd: c.primaryDark,
    sectionIconBg: isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.08)',
    sectionIconColor: c.primary,
    divider: c.divider,
    comingSoonBg: isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.08)',
    comingSoonText: c.primary,
    actionIconBg: isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.08)',
    actionIconBgMuted: isDark
      ? 'rgba(148, 163, 184, 0.18)'
      : 'rgba(148, 163, 184, 0.14)',
    textPrimary: c.textPrimary,
    textSecondary: c.textSecondary,
    textMuted: c.textDisabled,
    white: c.white,
    primary: c.primary,
    radius: {
      card: radius.xl,
      row: radius.md,
      badge: radius.full,
      avatar: radius.full,
      icon: radius.md,
    },
    spacing: {
      screenX: spacing[20],
      sectionGap: 28,
      cardPadding: spacing[20],
      heroTop: spacing[12],
      heroBottom: spacing[32],
      rowGap: spacing[16],
    },
    elevation: {
      card: elevation.sm,
      avatar: {
        shadowColor: c.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.35 : 0.22,
        shadowRadius: 16,
        elevation: 8,
      },
    },
    typography,
  } as const;
}

export function createStatusBadgePalettes(theme: Theme) {
  const isDark = theme.colors.background === colors.dark.background;
  return {
    verified: {
      background: isDark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(37, 99, 235, 0.12)',
      text: isDark ? '#93C5FD' : '#1D4ED8',
    },
    unverified: {
      background: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.14)',
      text: isDark ? '#FCD34D' : '#B45309',
    },
    suspended: {
      background: isDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.12)',
      text: isDark ? '#FCA5A5' : '#B91C1C',
    },
    pending: {
      background: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.12)',
      text: isDark ? '#CBD5E1' : '#475569',
    },
    admin: {
      background: isDark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(37, 99, 235, 0.12)',
      text: isDark ? '#93C5FD' : '#1D4ED8',
    },
    comingSoon: {
      background: isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.08)',
      text: theme.colors.primary,
    },
  } as const;
}

export type StatusBadgePalettes = ReturnType<typeof createStatusBadgePalettes>;

export function useProfileTokens(): ProfileTokens {
  const theme = useTheme();
  return useMemo(() => createProfileTokens(theme), [theme]);
}

export function useStatusBadgePalettes(): StatusBadgePalettes {
  const theme = useTheme();
  return useMemo(() => createStatusBadgePalettes(theme), [theme]);
}

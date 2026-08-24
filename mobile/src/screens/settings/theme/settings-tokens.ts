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
 * Settings visual tokens — theme-aware (Light / Dark).
 * Spacing/radius stay shared; colors follow the active app theme.
 */
export type SettingsTokens = ReturnType<typeof createSettingsTokens>;

export function createSettingsTokens(theme: Theme) {
  const isDark = theme.colors.background === colors.dark.background;
  const c = theme.colors;

  return {
    background: isDark ? c.background : '#F3F5F8',
    card: c.card,
    cardBorder: isDark ? 'rgba(248, 250, 252, 0.08)' : 'rgba(15, 23, 42, 0.06)',
    sectionIconBg: isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.08)',
    actionIconBg: isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.08)',
    actionIconBgMuted: isDark
      ? 'rgba(148, 163, 184, 0.18)'
      : 'rgba(148, 163, 184, 0.14)',
    divider: c.divider,
    comingSoonBg: isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.08)',
    comingSoonText: c.primary,
    destructiveBg: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.08)',
    destructiveText: isDark ? '#FCA5A5' : '#B91C1C',
    textPrimary: c.textPrimary,
    textSecondary: c.textSecondary,
    textMuted: c.textDisabled,
    white: c.white,
    primary: c.primary,
    radius: {
      card: radius.xl,
      row: radius.md,
      badge: radius.full,
      icon: radius.md,
    },
    spacing: {
      screenX: spacing[20],
      sectionGap: 28,
      cardPadding: spacing[20],
      headerTop: spacing[8],
      headerBottom: spacing[24],
      rowMinHeight: 64,
    },
    elevation: {
      card: elevation.sm,
    },
    typography,
  } as const;
}

export function useSettingsTokens(): SettingsTokens {
  const theme = useTheme();
  return useMemo(() => createSettingsTokens(theme), [theme]);
}

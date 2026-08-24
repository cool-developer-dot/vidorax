import { colors, radius, spacing, typography } from '@/theme';

export const bookmarksTokens = {
  background: colors.light.background,
  rowPressed: 'rgba(37, 99, 235, 0.06)',
  faviconBg: 'rgba(37, 99, 235, 0.08)',
  deleteButtonBg: 'rgba(239, 68, 68, 0.12)',
  deleteButtonPressed: 'rgba(239, 68, 68, 0.22)',
  divider: colors.light.divider,
  spacing: {
    screenX: spacing[16],
    rowY: spacing[12],
    rowGap: spacing[12],
  },
  radius: {
    favicon: radius.md,
    row: radius.md,
    deleteButton: radius.full,
  },
  typography,
  rowMinHeight: 64,
  faviconSize: 36,
  touchTarget: 44,
  deleteButtonSize: 40,
} as const;

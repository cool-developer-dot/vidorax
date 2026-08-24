import { colors, radius, spacing, typography } from '@/theme';

export const favoritesTokens = {
  background: colors.light.background,
  rowPressed: 'rgba(37, 99, 235, 0.06)',
  thumbnailBg: 'rgba(37, 99, 235, 0.08)',
  removeButtonBg: 'rgba(239, 68, 68, 0.12)',
  removeButtonPressed: 'rgba(239, 68, 68, 0.22)',
  unavailableBg: 'rgba(107, 114, 128, 0.10)',
  divider: colors.light.divider,
  spacing: {
    screenX: spacing[16],
    rowY: spacing[12],
    rowGap: spacing[12],
  },
  radius: {
    thumbnail: radius.sm,
    row: radius.md,
    removeButton: radius.full,
    badge: radius.full,
  },
  typography,
  rowMinHeight: 80,
  thumbnailSize: 64,
  touchTarget: 44,
  removeButtonSize: 40,
} as const;

import { colors, radius, spacing, typography } from '@/theme';

export const downloadsTokens = {
  background: colors.light.background,
  cardBg: colors.light.card,
  cardBorder: colors.light.border,
  rowPressed: 'rgba(37, 99, 235, 0.06)',
  thumbnailBg: 'rgba(37, 99, 235, 0.08)',
  actionButtonBg: 'rgba(37, 99, 235, 0.10)',
  actionButtonPressed: 'rgba(37, 99, 235, 0.18)',
  destructiveButtonBg: 'rgba(239, 68, 68, 0.12)',
  destructiveButtonPressed: 'rgba(239, 68, 68, 0.22)',
  divider: colors.light.divider,
  status: {
    QUEUED: {
      bg: 'rgba(107, 114, 128, 0.12)',
      fg: colors.light.textSecondary,
    },
    DOWNLOADING: {
      bg: 'rgba(37, 99, 235, 0.12)',
      fg: colors.light.primary,
    },
    PAUSED: {
      bg: 'rgba(245, 158, 11, 0.14)',
      fg: colors.light.warning,
    },
    COMPLETED: {
      bg: 'rgba(16, 185, 129, 0.12)',
      fg: colors.light.success,
    },
    FAILED: {
      bg: 'rgba(239, 68, 68, 0.12)',
      fg: colors.light.error,
    },
    CANCELLED: {
      bg: 'rgba(107, 114, 128, 0.12)',
      fg: colors.light.textSecondary,
    },
  },
  spacing: {
    screenX: spacing[16],
    rowY: spacing[12],
    cardGap: spacing[12],
    sectionTop: spacing[16],
    sectionBottom: spacing[8],
    controlsGap: spacing[8],
  },
  radius: {
    card: radius.md,
    thumbnail: radius.sm,
    badge: radius.full,
    action: radius.full,
  },
  typography,
  thumbnailSize: 72,
  heroHeight: 200,
  touchTarget: 44,
  actionButtonSize: 44,
  emptyIconSize: 48,
} as const;

import { colors, radius, spacing, typography } from '@/theme';

export const libraryTokens = {
  spacing: {
    screenX: spacing[16],
    rowY: spacing[12],
    cardGap: spacing[12],
    controlsGap: spacing[8],
    gridGap: spacing[12],
  },
  radius: {
    card: radius.md,
    thumbnail: radius.sm,
    tile: radius.md,
  },
  typography,
  thumbnailSize: 72,
  gridThumbnailHeight: 96,
  touchTarget: 44,
  emptyIconSize: 48,
  listRowHeight: 96,
  favorite: colors.light.error,
} as const;

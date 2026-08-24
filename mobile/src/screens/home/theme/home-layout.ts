import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Home layout composed only from existing theme tokens.
 * No Home-specific color system.
 */
export function useHomeLayout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const screenX = theme.spacing[16];
    const itemGap = theme.spacing[12];
    const preferredWidth =
      theme.spacing[64] + theme.spacing[56] + theme.spacing[48];
    const availableWidth = width - screenX * 2 - itemGap;
    const stackedActions = width < theme.spacing[64] * 5;

    return {
      theme,
      screenX,
      itemGap,
      sectionTop: theme.spacing[20],
      headerY: theme.spacing[12],
      actionsTop: theme.spacing[16],
      cardPadding: theme.spacing[8],
      cardWidth: Math.min(preferredWidth, Math.max(theme.spacing[64] + theme.spacing[48], availableWidth)),
      mediaRadius: theme.radius.md,
      thumbRadius: theme.radius.sm,
      progressHeight: theme.spacing[4],
      logoSize: theme.icons.lg,
      touchTarget: theme.spacing[24] + theme.spacing[20],
      metaGap: theme.spacing[4],
      titleGap: theme.spacing[2],
      scrollBottom: theme.spacing[32],
      storageBottom: theme.spacing[8],
      stackedActions,
    };
  }, [theme, width]);
}

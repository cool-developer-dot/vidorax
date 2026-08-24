import { memo, useCallback, useMemo } from 'react';

import { Box } from '@/components/base/Box';
import { useTheme } from '@/hooks/use-theme';

import { BROWSER_TOOLBAR_HEIGHT } from '@/browser/constants';
import { useBrowserNavigation } from '@/browser/hooks';
import { useTranslation } from '@/localization';

import { getBrowserToolbarItems, type BrowserToolbarItemId } from './toolbar-config';
import { ToolbarButton } from './ToolbarButton';

export type BrowserToolbarProps = {
  testID?: string;
};

/**
 * Minimal production toolbar: Back, Forward, Home.
 * Future actions flip `enabled` in toolbar-config — no layout changes required.
 */
export const BrowserToolbar = memo(function BrowserToolbar({
  testID = 'browser-toolbar',
}: BrowserToolbarProps) {
  const theme = useTheme();
  const { t, rtl } = useTranslation();
  const {
    canGoBack,
    canGoForward,
    handleBack,
    handleForward,
    handleHome,
  } = useBrowserNavigation();

  const visibleItems = useMemo(
    () =>
      getBrowserToolbarItems(t)
        .filter((item) => item.enabled)
        .map((item) =>
          item.id === 'back'
            ? { ...item, icon: rtl.arrowBack }
            : item.id === 'forward'
              ? { ...item, icon: rtl.arrowForward }
              : item,
        ),
    [rtl.arrowBack, rtl.arrowForward, t],
  );

  const resolveDisabled = useCallback(
    (id: BrowserToolbarItemId): boolean => {
      if (id === 'back') {
        return !canGoBack;
      }
      if (id === 'forward') {
        return !canGoForward;
      }
      return false;
    },
    [canGoBack, canGoForward],
  );

  const resolvePress = useCallback(
    (id: BrowserToolbarItemId) => {
      switch (id) {
        case 'back':
          return handleBack;
        case 'forward':
          return handleForward;
        case 'home':
          return handleHome;
        default:
          return () => undefined;
      }
    },
    [handleBack, handleForward, handleHome],
  );

  return (
    <Box
      testID={testID}
      row
      px={8}
      style={{
        height: BROWSER_TOOLBAR_HEIGHT,
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.divider,
      }}
      accessibilityRole="toolbar">
      {visibleItems.map((item) => (
        <ToolbarButton
          key={item.id}
          icon={item.icon}
          accessibilityLabel={item.accessibilityLabel}
          disabled={resolveDisabled(item.id)}
          onPress={resolvePress(item.id)}
          testID={`${testID}-${item.id}`}
        />
      ))}
    </Box>
  );
});

import { memo } from 'react';

import { Box } from '@/components/base/Box';
import { Icon } from '@/components/base/Icon';
import { Text } from '@/components/base/Text';
import { useTheme } from '@/hooks/use-theme';
import { environment } from '@/constants/environment';

export type BrowserHomeViewProps = {
  testID?: string;
};

/**
 * Branded browser landing surface.
 * Intentionally minimal — reserved for future suggestions, recents, and shortcuts.
 */
export const BrowserHomeView = memo(function BrowserHomeView({
  testID = 'browser-home',
}: BrowserHomeViewProps) {
  const theme = useTheme();

  return (
    <Box
      testID={testID}
      flex={1}
      center
      px={32}
      gap={20}
      backgroundColor="background"
      accessibilityRole="text"
      accessibilityLabel={`${environment.appName} browser home`}>
      <Box
        center
        style={{
          width: 72,
          height: 72,
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}>
        <Icon name="web" size="xl" color="primary" />
      </Box>

      <Box center gap={8}>
        <Text variant="title" align="center">
          {environment.appName}
        </Text>
        <Text variant="bodySmall" color="textSecondary" align="center">
          Search the web or type a website address above to get started.
        </Text>
      </Box>
    </Box>
  );
});

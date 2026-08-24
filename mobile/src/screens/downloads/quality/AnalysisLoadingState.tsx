import { memo } from 'react';
import { StyleSheet } from 'react-native';

import { Box } from '@/components/base/Box';
import { Text } from '@/components/base/Text';
import { Skeleton } from '@/components/common/Skeleton';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/localization';

export const AnalysisLoadingState = memo(function AnalysisLoadingState() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box
      gap={16}
      accessibilityRole="progressbar"
      accessibilityLabel={t('downloads.analyzing')}
      accessibilityLiveRegion="polite">
      <Box
        row
        gap={14}
        p={14}
        borderRadius="md"
        style={{
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          alignItems: 'center',
        }}>
        <Skeleton width={64} height={64} borderRadius={theme.radius.sm} />
        <Box flex={1} gap={8}>
          <Skeleton width="78%" height={16} />
          <Skeleton width="48%" height={12} />
          <Skeleton width="36%" height={12} />
        </Box>
      </Box>

      <Box gap={10}>
        <Text variant="label" color="textSecondary">
          {t('downloads.analyzing')}
        </Text>
        <Skeleton width="100%" height={64} borderRadius={theme.radius.md} />
      </Box>
    </Box>
  );
});

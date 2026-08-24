import { memo } from 'react';

import { Box } from '@/components/base/Box';
import { Text } from '@/components/base/Text';

import { historyTokens } from '../theme/history-tokens';

export type HistorySectionProps = {
  title: string;
  testID?: string;
};

export const HistorySectionHeader = memo(function HistorySectionHeader({
  title,
  testID,
}: HistorySectionProps) {
  return (
    <Box
      testID={testID}
      px={historyTokens.spacing.screenX}
      style={{
        paddingTop: historyTokens.spacing.sectionTop,
        paddingBottom: historyTokens.spacing.sectionBottom,
        backgroundColor: historyTokens.background,
      }}
      accessibilityRole="header">
      <Text
        variant="label"
        color="textSecondary"
        style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </Text>
    </Box>
  );
});

import { memo, type ReactNode } from 'react';
import { View } from 'react-native';

import { Box } from '@/components/base/Box';
import { Text } from '@/components/base/Text';

import { useProfileTokens } from '../theme/profile-tokens';

export type ProfileInfoRowProps = {
  label: string;
  value: string;
  showDivider?: boolean;
  /** Softer typography for secondary cards. */
  secondary?: boolean;
  /** Truncate long values (e.g. User ID) with middle ellipsis. */
  truncate?: boolean;
  /** Render trailing control instead of (or beside) the value text. */
  trailing?: ReactNode;
  /** When true, hide the text value and show only trailing (e.g. status badge). */
  trailingOnly?: boolean;
  testID?: string;
};

/**
 * Editorial information row — small label above large value.
 */
export const ProfileInfoRow = memo(function ProfileInfoRow({
  label,
  value,
  showDivider = true,
  secondary = false,
  truncate = false,
  trailing,
  trailingOnly = false,
  testID,
}: ProfileInfoRowProps) {
  const profileTokens = useProfileTokens();
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}>
      <Box py={secondary ? 12 : 14} gap={6}>
        <Text
          variant="caption"
          style={{
            color: profileTokens.textMuted,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            fontSize: 11,
            lineHeight: 14,
          }}>
          {label}
        </Text>
        <Box row gap={10} style={{ alignItems: 'center' }}>
          {trailingOnly ? null : (
            <Text
              variant={secondary ? 'bodySmall' : 'body'}
              selectable
              numberOfLines={truncate ? 1 : undefined}
              ellipsizeMode={truncate ? 'middle' : undefined}
              style={{
                flex: 1,
                lineHeight: secondary ? 20 : 22,
                letterSpacing: -0.1,
                color: profileTokens.textPrimary,
              }}>
              {value}
            </Text>
          )}
          {trailing}
        </Box>
      </Box>
      {showDivider ? (
        <View
          style={{
            height: 1,
            backgroundColor: profileTokens.divider,
          }}
          accessibilityRole="none"
        />
      ) : null}
    </View>
  );
});

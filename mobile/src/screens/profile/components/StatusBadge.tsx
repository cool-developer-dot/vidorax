import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/base/Text';

import { useStatusBadgePalettes, type StatusBadgeTone } from '../theme/profile-tokens';

export type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Soft, modern status chip — Light / Dark via profile token palettes.
 * Verified → blue · Unverified → amber · Suspended → red · Pending → grey
 */
export const StatusBadge = memo(function StatusBadge({
  label,
  tone = 'pending',
  style,
  testID,
}: StatusBadgeProps) {
  const statusBadgePalettes = useStatusBadgePalettes();
  const palette = statusBadgePalettes[tone];

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: palette.background,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Text
        variant="caption"
        style={{
          color: palette.text,
          fontVariant: undefined,
          letterSpacing: 0.2,
        }}>
        {label}
      </Text>
    </View>
  );
});

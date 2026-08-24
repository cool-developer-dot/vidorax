import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/base/Text';
import { useTheme } from '@/hooks/use-theme';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

export type BadgeProps = {
  label: string | number;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Soft, modern pill badge (light-first).
 * Prefer StatusBadge on Profile for semantic account tones.
 */
const softVariants: Record<
  BadgeVariant,
  { background: string; text: string }
> = {
  default: { background: 'rgba(100, 116, 139, 0.12)', text: '#475569' },
  primary: { background: 'rgba(37, 99, 235, 0.12)', text: '#1D4ED8' },
  success: { background: 'rgba(16, 185, 129, 0.12)', text: '#047857' },
  warning: { background: 'rgba(245, 158, 11, 0.14)', text: '#B45309' },
  error: { background: 'rgba(239, 68, 68, 0.12)', text: '#B91C1C' },
};

export const Badge = memo(function Badge({
  label,
  variant = 'default',
  style,
  testID,
}: BadgeProps) {
  const theme = useTheme();
  const colors = softVariants[variant];

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={String(label)}
      style={[
        {
          minWidth: theme.spacing[20],
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: theme.radius.full,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Text variant="caption" style={{ color: colors.text, letterSpacing: 0.2 }}>
        {label}
      </Text>
    </View>
  );
});

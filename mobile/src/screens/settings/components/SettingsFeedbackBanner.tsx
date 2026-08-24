import { memo } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { Box } from '@/components/base/Box';
import { Icon } from '@/components/base/Icon';
import { Text } from '@/components/base/Text';

import { useSettingsTokens } from '../theme/settings-tokens';

export type SettingsFeedbackBannerProps = {
  visible: boolean;
  tone?: 'success' | 'pending' | 'error';
  title: string;
  message: string;
  testID?: string;
};

const TONE_STYLES = {
  success: {
    background: 'rgba(37, 99, 235, 0.1)',
    border: 'rgba(37, 99, 235, 0.18)',
    iconBg: 'rgba(37, 99, 235, 0.14)',
    icon: 'check-circle' as const,
    iconColor: 'primary' as const,
  },
  pending: {
    background: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.22)',
    iconBg: 'rgba(245, 158, 11, 0.16)',
    icon: 'cloud-outline' as const,
    iconColor: 'warning' as const,
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.18)',
    iconBg: 'rgba(239, 68, 68, 0.14)',
    icon: 'alert-circle-outline' as const,
    iconColor: 'error' as const,
  },
} as const;

/**
 * Non-blocking feedback for preference save / offline queue / rollback errors.
 */
export const SettingsFeedbackBanner = memo(function SettingsFeedbackBanner({
  visible,
  tone = 'success',
  title,
  message,
  testID = 'settings-feedback-banner',
}: SettingsFeedbackBannerProps) {
  const settingsTokens = useSettingsTokens();
  if (!visible) {
    return null;
  }

  const palette = TONE_STYLES[tone];

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      exiting={FadeOutUp.duration(200)}
      testID={testID}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}`}
      style={{ marginBottom: 16 }}>
      <View
        style={{
          backgroundColor: palette.background,
          borderRadius: settingsTokens.radius.card,
          borderWidth: 1,
          borderColor: palette.border,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}>
        <Box row rtlRow gap={12} style={{ alignItems: 'flex-start' }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: palette.iconBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityElementsHidden
            importantForAccessibility="no">
            <Icon name={palette.icon} size="md" color={palette.iconColor} />
          </View>
          <Box flex={1} gap={2}>
            <Text
              variant="subtitle"
              style={{
                letterSpacing: -0.2,
                color: settingsTokens.textPrimary,
              }}>
              {title}
            </Text>
            <Text
              variant="caption"
              style={{ lineHeight: 18, color: settingsTokens.textSecondary }}>
              {message}
            </Text>
          </Box>
        </Box>
      </View>
    </Animated.View>
  );
});

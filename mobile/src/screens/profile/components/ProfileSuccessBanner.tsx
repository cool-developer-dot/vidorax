import { memo } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { Box } from '@/components/base/Box';
import { Icon } from '@/components/base/Icon';
import { Text } from '@/components/base/Text';

import { useTranslation } from '@/localization';
import { useProfileTokens } from '../theme/profile-tokens';

export type ProfileSuccessBannerProps = {
  visible: boolean;
  title?: string;
  message?: string;
  testID?: string;
};

/**
 * Non-blocking success confirmation for profile edits.
 * Enter/exit layout animations own opacity — do not also drive opacity on
 * this same Animated.View (Reanimated overwrites and warns).
 */
export const ProfileSuccessBanner = memo(function ProfileSuccessBanner({
  visible,
  title,
  message,
  testID = 'edit-profile-success-banner',
}: ProfileSuccessBannerProps) {
  const profileTokens = useProfileTokens();
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('profile.editSuccessTitle');
  const resolvedMessage = message ?? t('profile.editSuccessMessage');
  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      exiting={FadeOutUp.duration(200)}
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert">
      <View
        style={{
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderRadius: profileTokens.radius.card,
          borderWidth: 1,
          borderColor: 'rgba(37, 99, 235, 0.18)',
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}>
        <Box row gap={12} style={{ alignItems: 'flex-start' }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: 'rgba(37, 99, 235, 0.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityElementsHidden
            importantForAccessibility="no">
            <Icon name="check-circle" size="md" color="primary" />
          </View>
          <Box flex={1} gap={2}>
            <Text
              variant="subtitle"
              style={{
                letterSpacing: -0.2,
                color: profileTokens.textPrimary,
              }}>
              {resolvedTitle}
            </Text>
            <Text
              variant="caption"
              style={{ lineHeight: 18, color: profileTokens.textSecondary }}>
              {resolvedMessage}
            </Text>
          </Box>
        </Box>
      </View>
    </Animated.View>
  );
});

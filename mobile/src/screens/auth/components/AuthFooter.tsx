import { memo } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Pressable } from '@/components/base/Pressable';
import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { AUTH_LAYOUT } from '../constants';
import { authStyles } from '../styles';

type AuthFooterProps = {
  disabled?: boolean;
  prompt?: string;
  actionLabel?: string;
  onAction: () => void;
};

export const AuthFooter = memo(function AuthFooter({
  disabled = false,
  prompt,
  actionLabel,
  onAction,
}: AuthFooterProps) {
  const { t } = useTranslation();
  const resolvedPrompt = prompt ?? t('auth.noAccount');
  const resolvedActionLabel = actionLabel ?? t('auth.createAccount');
  const linkOpacity = useSharedValue(1);

  const linkStyle = useAnimatedStyle(() => ({
    opacity: linkOpacity.value,
  }));

  return (
    <View style={authStyles.footer}>
      <Text
        style={[authStyles.footerPrompt, { fontFamily: fontFamilies.body }]}
        maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
        {resolvedPrompt}
      </Text>
      <Pressable
        disabled={disabled}
        onPress={onAction}
        hitSlop={10}
        accessibilityRole="link"
        accessibilityLabel={resolvedActionLabel}
        pressedOpacity={1}
        onPressIn={() => {
          linkOpacity.value = withTiming(0.55, { duration: 90 });
        }}
        onPressOut={() => {
          linkOpacity.value = withTiming(1, { duration: 160 });
        }}>
        <Animated.View style={linkStyle}>
          <Text
            style={[authStyles.footerLink, { fontFamily: fontFamilies.bodySemiBold }]}
            maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
            {resolvedActionLabel}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
});

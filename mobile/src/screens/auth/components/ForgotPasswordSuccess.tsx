import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';

import { PrimaryAuthButton } from './PrimaryAuthButton';

type ForgotPasswordSuccessProps = {
  onBackToLogin: () => void;
};

/**
 * Truthful unavailable confirmation for password reset (no fake success checkmark).
 */
export const ForgotPasswordSuccess = memo(function ForgotPasswordSuccess({
  onBackToLogin,
}: ForgotPasswordSuccessProps) {
  const { t } = useTranslation();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(0, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [opacity, translateY]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      accessibilityLabel={t('auth.forgotSuccessA11y')}>
      <View style={styles.iconWrap}>
        <View style={styles.badge}>
          <Info size={22} color={AUTH_COLORS.accent} strokeWidth={2.4} />
        </View>
      </View>

      <Text
        style={[styles.title, { fontFamily: fontFamilies.heading }]}
        maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}
        accessibilityRole="header">
        {t('auth.forgotSuccessTitle')}
      </Text>

      <Text
        style={[styles.message, { fontFamily: fontFamilies.body }]}
        maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}
        numberOfLines={4}>
        {t('auth.forgotSuccessMessage')}
      </Text>

      <View style={styles.action}>
        <PrimaryAuthButton
          title={t('auth.backToLogin')}
          onPress={onBackToLogin}
        />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.inputBg,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  title: {
    color: AUTH_COLORS.title,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  message: {
    color: AUTH_COLORS.subtitle,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },
  action: {
    width: '100%',
    marginTop: 10,
  },
});

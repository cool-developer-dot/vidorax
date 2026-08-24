import { memo, useEffect } from 'react';
import { Image } from 'expo-image';
import { Text } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { AUTH_LAYOUT, AUTH_LOGO } from '../constants';
import { AUTH_FLIP } from '../constants/auth-flip.constants';
import { AuthStaggerItem, useAuthFlipMotion } from '../motion';
import { authStyles } from '../styles';

type AuthHeaderProps = {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
};

export const AuthHeader = memo(function AuthHeader({
  enabled = true,
  title,
  subtitle,
}: AuthHeaderProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('auth.signInTitle');
  const resolvedSubtitle = subtitle ?? t('auth.signInSubtitle');
  const flipMotion = useAuthFlipMotion();
  const opacity = useSharedValue(enabled ? 0 : 1);
  const translateY = useSharedValue(enabled ? 12 : 0);
  const glow = useSharedValue(enabled ? 0 : 1);

  useEffect(() => {
    if (!enabled) {
      opacity.value = 1;
      translateY.value = 0;
      glow.value = 1;
      return;
    }

    opacity.value = withDelay(
      80,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      80,
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    glow.value = withDelay(
      160,
      withTiming(1, { duration: 640, easing: Easing.inOut(Easing.cubic) }),
    );
  }, [enabled, glow, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const logoStyle = useAnimatedStyle(() => {
    const progress = flipMotion?.progress.value ?? 0;
    const role = flipMotion?.role ?? 'front';

    // Counter-rotate so the brand stays facing the user in world space.
    const cardRotateY =
      role === 'front' ? progress * 180 : 180 + progress * 180;
    const facing = -cardRotateY;

    const midBoost = interpolate(
      progress,
      [0, 0.5, 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );

    const scale = interpolate(
      midBoost,
      [0, 1],
      [AUTH_FLIP.logo.scaleEnd, AUTH_FLIP.logo.scaleStart + 0.03],
      Extrapolation.CLAMP,
    );

    // Ease into full scale as the destination face settles.
    const settleScale = interpolate(
      role === 'front' ? 1 - progress : progress,
      [0, 0.55, 1],
      [AUTH_FLIP.logo.scaleStart, AUTH_FLIP.logo.scaleStart, AUTH_FLIP.logo.scaleEnd],
      Extrapolation.CLAMP,
    );

    return {
      opacity: 0.92 + midBoost * 0.08,
      transform: [
        { perspective: AUTH_FLIP.perspective },
        { rotateY: `${facing}deg` },
        { scale: scale * settleScale },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const progress = flipMotion?.progress.value ?? 0;
    const midBoost = interpolate(
      progress,
      [0, 0.5, 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    const base = glow.value * 0.9;
    return {
      opacity: base * (1 + midBoost * (AUTH_FLIP.logo.glowPeak - 1)),
      transform: [{ scale: 1 + midBoost * 0.08 }],
    };
  });

  return (
    <Animated.View style={[authStyles.brand, style]}>
      <Animated.View
        style={[authStyles.logoWrap, logoStyle]}
        accessibilityLabel={t('common.logoA11y')}
        accessible>
        <Animated.View pointerEvents="none" style={[authStyles.logoGlow, glowStyle]} />
        <Image
          source={AUTH_LOGO}
          style={authStyles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey="vidorax-auth-logo"
        />
      </Animated.View>

      <AuthStaggerItem step="title">
        <Text
          accessibilityRole="header"
          style={[authStyles.title, { fontFamily: fontFamilies.heading }]}
          maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
          {resolvedTitle}
        </Text>
      </AuthStaggerItem>

      <AuthStaggerItem step="subtitle">
        <Text
          style={[authStyles.subtitle, { fontFamily: fontFamilies.body }]}
          maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}
          numberOfLines={2}>
          {resolvedSubtitle}
        </Text>
      </AuthStaggerItem>
    </Animated.View>
  );
});

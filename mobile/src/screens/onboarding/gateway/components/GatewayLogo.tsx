import { Image } from 'expo-image';
import { memo } from 'react';
import { View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { GATEWAY_LOGO } from '../constants/gateway.constants';
import { useTranslation } from '@/localization';
import { gatewayStyles } from '../styles/gateway.styles';

type GatewayLogoProps = {
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
  translateY: SharedValue<number>;
  glow: SharedValue<number>;
  breath: SharedValue<number>;
};

export const GatewayLogo = memo(function GatewayLogo({
  opacity,
  scale,
  translateY,
  glow,
  breath,
}: GatewayLogoProps) {
  const { t } = useTranslation();
  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value * breath.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(glow.value, 1) * 0.9,
    transform: [{ scale: 0.92 + Math.min(glow.value, 1.4) * 0.08 }],
  }));

  return (
    <View style={gatewayStyles.logoWrap} accessibilityLabel={t('common.logoA11y')} accessible>
      <Animated.View pointerEvents="none" style={[gatewayStyles.logoGlow, glowStyle]} />
      <Animated.View style={logoStyle}>
        <Image
          source={GATEWAY_LOGO}
          style={gatewayStyles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey="vidorax-gateway-logo"
        />
      </Animated.View>
    </View>
  );
});

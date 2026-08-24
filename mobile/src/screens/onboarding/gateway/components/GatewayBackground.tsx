import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { GATEWAY_COLORS } from '../constants/gateway.constants';

type GatewayBackgroundProps = {
  opacity: SharedValue<number>;
};

/**
 * Near-black canvas only — no giant disk trapping the ecosystem.
 * Soft logo-centric glow lives on the logo itself.
 */
export const GatewayBackground = memo(function GatewayBackground({
  opacity,
}: GatewayBackgroundProps) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <View style={styles.base} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: GATEWAY_COLORS.background,
  },
});

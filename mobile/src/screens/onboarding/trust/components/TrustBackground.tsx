import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { TRUST_COLORS, TRUST_LAYOUT } from '../constants';

type TrustBackgroundProps = {
  opacity: SharedValue<number>;
  ambientGlow: SharedValue<number>;
};

/**
 * Near-black luxury canvas with a soft radial accent behind the hero.
 * Solid fills only — no BlurView / heavy shadows.
 */
export const TrustBackground = memo(function TrustBackground({
  opacity,
  ambientGlow,
}: TrustBackgroundProps) {
  const canvasStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: ambientGlow.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, canvasStyle]}>
      <View style={styles.base} />
      <Animated.View style={[styles.glow, glowStyle]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFill,
    backgroundColor: TRUST_COLORS.background,
  },
  glow: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -TRUST_LAYOUT.glowSize / 2,
    width: TRUST_LAYOUT.glowSize,
    height: TRUST_LAYOUT.glowSize,
    borderRadius: TRUST_LAYOUT.glowSize / 2,
    backgroundColor: TRUST_COLORS.radialGlow,
  },
});

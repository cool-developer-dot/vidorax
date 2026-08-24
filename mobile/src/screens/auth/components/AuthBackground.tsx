import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';
import { AUTH_FLIP } from '../constants/auth-flip.constants';

type AuthBackgroundProps = {
  enabled?: boolean;
};

/**
 * Near-black luxury canvas with an extremely slow ambient breath.
 * Must never compete with the card flip — opacity-only, GPU-friendly.
 */
export const AuthBackground = memo(function AuthBackground({
  enabled = true,
}: AuthBackgroundProps) {
  const glow = useSharedValue(0.78);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      glow.value = 0.78;
      drift.value = 0;
      return;
    }

    const half = AUTH_FLIP.ambientBreathMs / 2;

    glow.value = withRepeat(
      withSequence(
        withTiming(0.92, { duration: half, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.7, { duration: half, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    drift.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: AUTH_FLIP.ambientBreathMs,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: AUTH_FLIP.ambientBreathMs,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
  }, [drift, enabled, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [
      { translateX: (drift.value - 0.5) * 12 },
      { translateY: (0.5 - drift.value) * 8 },
      { scale: 1 + drift.value * 0.04 },
    ],
  }));

  const secondaryStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + glow.value * 0.12,
    transform: [
      { translateX: (0.5 - drift.value) * 18 },
      { translateY: (drift.value - 0.5) * 10 },
    ],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.base} />
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.View style={[styles.secondary, secondaryStyle]} />
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFill,
    backgroundColor: AUTH_COLORS.background,
  },
  glow: {
    position: 'absolute',
    top: '12%',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -AUTH_LAYOUT.logoGlowSize,
    width: AUTH_LAYOUT.logoGlowSize * 2,
    height: AUTH_LAYOUT.logoGlowSize * 2,
    borderRadius: AUTH_LAYOUT.logoGlowSize,
    backgroundColor: AUTH_COLORS.radialGlow,
  },
  secondary: {
    position: 'absolute',
    top: '42%',
    right: '-8%',
    width: AUTH_LAYOUT.logoGlowSize * 1.4,
    height: AUTH_LAYOUT.logoGlowSize * 1.4,
    borderRadius: AUTH_LAYOUT.logoGlowSize,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
});

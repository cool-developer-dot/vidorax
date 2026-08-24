import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { SPLASH_COLORS, SPLASH_LAYOUT } from '../constants/splash.constants';
import { useTranslation } from '@/localization';

type SplashLoaderProps = {
  opacity: SharedValue<number>;
  progress: SharedValue<number>;
};

/** Ultra-thin determinate line — continuous 0→100%, rounded ends. */
export const SplashLoader = memo(function SplashLoader({
  opacity,
  progress,
}: SplashLoaderProps) {
  const { t } = useTranslation();
  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.min(
      SPLASH_LAYOUT.loaderWidth,
      Math.max(0, progress.value * SPLASH_LAYOUT.loaderWidth),
    ),
  }));

  return (
    <Animated.View
      style={[styles.slot, containerStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel={t('splash.loadingA11y')}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  slot: {
    marginTop: 36,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: SPLASH_LAYOUT.loaderWidth,
    height: SPLASH_LAYOUT.loaderHeight,
    borderRadius: SPLASH_LAYOUT.loaderHeight,
    backgroundColor: SPLASH_COLORS.loaderTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: SPLASH_LAYOUT.loaderHeight,
    backgroundColor: SPLASH_COLORS.loaderFill,
  },
});

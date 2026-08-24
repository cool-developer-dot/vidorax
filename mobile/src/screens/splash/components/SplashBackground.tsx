import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SPLASH_COLORS } from '../constants/splash.constants';

/** Full-screen cinematic black — everything else starts hidden. */
export const SplashBackground = memo(function SplashBackground() {
  return <View pointerEvents="none" style={styles.base} />;
});

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SPLASH_COLORS.background,
  },
});

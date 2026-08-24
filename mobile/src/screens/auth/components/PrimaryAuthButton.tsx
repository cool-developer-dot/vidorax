import { memo, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Pressable } from '@/components/base/Pressable';
import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';

type PrimaryAuthButtonProps = {
  title?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * Full-width auth CTA with press scale + seamless loading morph.
 */
export const PrimaryAuthButton = memo(function PrimaryAuthButton({
  title,
  loading = false,
  disabled = false,
  onPress,
}: PrimaryAuthButtonProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('auth.signIn');
  const scale = useSharedValue(1);
  const loadingProgress = useSharedValue(loading ? 1 : 0);
  const isDisabled = disabled || loading;

  useEffect(() => {
    loadingProgress.value = withTiming(loading ? 1 : 0, { duration: 180 });
  }, [loading, loadingProgress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isDisabled && !loading ? 0.55 : 1,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 1 - loadingProgress.value,
    transform: [{ scale: 1 - loadingProgress.value * 0.04 }],
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: loadingProgress.value,
    transform: [{ scale: 0.92 + loadingProgress.value * 0.08 }],
  }));

  return (
    <Animated.View style={style}>
      <Pressable
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.98, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 140 });
        }}
        accessibilityRole="button"
        accessibilityLabel={resolvedTitle}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={styles.button}
        pressedOpacity={1}>
        <View pointerEvents="none" style={styles.baseFill} />
        <View pointerEvents="none" style={styles.topSheen} />
        <View pointerEvents="none" style={styles.glow} />
        <Animated.View style={[styles.centerLayer, labelStyle]} pointerEvents="none">
          <Text
            style={[styles.label, { fontFamily: fontFamilies.bodySemiBold }]}
            maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
            {resolvedTitle}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.centerLayer, spinnerStyle]} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  button: {
    height: AUTH_LAYOUT.buttonHeight,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: AUTH_COLORS.buttonStart,
  },
  baseFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: AUTH_COLORS.buttonEnd,
    opacity: 0.88,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  glow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: AUTH_COLORS.accentGlow,
    opacity: 0.18,
  },
  centerLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});

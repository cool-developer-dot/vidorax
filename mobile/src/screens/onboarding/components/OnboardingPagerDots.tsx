import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ONBOARDING_COLORS, ONBOARDING_PAGE_COUNT } from '../constants';

type OnboardingPagerDotsProps = {
  activeIndex: number;
};

export const OnboardingPagerDots = memo(function OnboardingPagerDots({
  activeIndex,
}: OnboardingPagerDotsProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="adjustable"
      accessibilityLabel={`Onboarding step ${activeIndex + 1} of ${ONBOARDING_PAGE_COUNT}`}>
      {Array.from({ length: ONBOARDING_PAGE_COUNT }, (_, index) => (
        <Dot key={index} active={index === activeIndex} />
      ))}
    </View>
  );
});

const Dot = memo(function Dot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? 18 : 6);
  const opacity = useSharedValue(active ? 1 : 0.45);

  useEffect(() => {
    width.value = withTiming(active ? 18 : 6, { duration: 280 });
    opacity.value = withTiming(active ? 1 : 0.45, { duration: 280 });
  }, [active, opacity, width]);

  const style = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: active ? ONBOARDING_COLORS.accent : ONBOARDING_COLORS.dotInactive,
        },
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 64,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});

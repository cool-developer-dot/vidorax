import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { fontFamilies } from '@/theme/typography';
import { useTranslation } from '@/localization';

import { TRUST_COLORS, TRUST_LAYOUT, TRUST_WORKFLOW } from '../constants';

type ProgressTimelineProps = {
  progress: SharedValue<number>;
  progressOpacity: SharedValue<number>;
  completedOpacity: SharedValue<number>;
};

/**
 * Premium 2.5px progress rail that morphs into "Completed ✓".
 * Fill width is continuously interpolated — never jumps.
 */
export const ProgressTimeline = memo(function ProgressTimeline({
  progress,
  progressOpacity,
  completedOpacity,
}: ProgressTimelineProps) {
  const { t } = useTranslation();
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(Math.max(progress.value, 0), 1) * 100}%`,
  }));

  const railStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
  }));

  const doneStyle = useAnimatedStyle(() => ({
    opacity: completedOpacity.value,
    transform: [{ scale: 0.98 + completedOpacity.value * 0.02 }],
  }));

  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding.progressA11y')}>
      <Animated.View style={[styles.railWrap, railStyle]}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.completed, doneStyle]} pointerEvents="none">
        <Text
          style={[styles.completedText, { fontFamily: fontFamilies.bodySemiBold }]}
          maxFontSizeMultiplier={TRUST_LAYOUT.maxFontMultiplier}>
          {TRUST_WORKFLOW.completedLabel}
        </Text>
        <View style={styles.checkBadge}>
          <Check size={12} color={TRUST_COLORS.accent} strokeWidth={2.5} />
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    marginTop: 14,
    minHeight: 22,
    justifyContent: 'center',
  },
  railWrap: {
    justifyContent: 'center',
  },
  track: {
    height: TRUST_LAYOUT.progressHeight,
    borderRadius: TRUST_LAYOUT.progressHeight,
    backgroundColor: TRUST_COLORS.progressTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: TRUST_LAYOUT.progressHeight,
    backgroundColor: TRUST_COLORS.accent,
  },
  completed: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedText: {
    color: TRUST_COLORS.softWhite,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TRUST_COLORS.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TRUST_COLORS.glassBorderActive,
  },
});

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Link2 } from 'lucide-react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { fontFamilies } from '@/theme/typography';

import { TRUST_COLORS, TRUST_LAYOUT, TRUST_WORKFLOW } from '../constants';

type UrlStageProps = {
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
  translateY: SharedValue<number>;
  urlLabelOpacity: SharedValue<number>;
  detectedOpacity: SharedValue<number>;
  checkOpacity: SharedValue<number>;
  checkScale: SharedValue<number>;
  checkGlow: SharedValue<number>;
};

/**
 * Floating URL glass chip that morphs into "✓ Video Detected".
 */
export const UrlStage = memo(function UrlStage({
  opacity,
  scale,
  translateY,
  urlLabelOpacity,
  detectedOpacity,
  checkOpacity,
  checkScale,
  checkGlow,
}: UrlStageProps) {
  const chipStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const urlStyle = useAnimatedStyle(() => ({
    opacity: urlLabelOpacity.value,
  }));

  const detectedStyle = useAnimatedStyle(() => ({
    opacity: detectedOpacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: checkGlow.value * 0.55,
    transform: [{ scale: 0.85 + checkGlow.value * 0.35 }],
  }));

  return (
    <Animated.View
      style={[styles.chip, chipStyle]}
      accessibilityLabel={`${TRUST_WORKFLOW.urlDisplay}. ${TRUST_WORKFLOW.detectedLabel}`}>
      <Animated.View style={[styles.urlRow, urlStyle]} pointerEvents="none">
        <Link2 size={14} color={TRUST_COLORS.chipIcon} strokeWidth={2} />
        <Text
          style={[styles.urlText, { fontFamily: fontFamilies.body }]}
          maxFontSizeMultiplier={TRUST_LAYOUT.maxFontMultiplier}
          numberOfLines={1}>
          {TRUST_WORKFLOW.urlDisplay}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.detectedRow, detectedStyle]} pointerEvents="none">
        <View style={styles.checkWrap}>
          <Animated.View style={[styles.checkGlow, glowStyle]} />
          <Animated.View style={[styles.checkBadge, checkStyle]}>
            <Check size={12} color={TRUST_COLORS.accent} strokeWidth={2.6} />
          </Animated.View>
        </View>
        <Text
          style={[styles.detectedText, { fontFamily: fontFamilies.bodySemiBold }]}
          maxFontSizeMultiplier={TRUST_LAYOUT.maxFontMultiplier}
          numberOfLines={1}>
          {TRUST_WORKFLOW.detectedLabel}
        </Text>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    borderColor: TRUST_COLORS.glassBorder,
    backgroundColor: TRUST_COLORS.glassBg,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urlText: {
    color: TRUST_COLORS.chipText,
    fontSize: 13,
    letterSpacing: 0.15,
  },
  detectedRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  checkWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlow: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: TRUST_COLORS.accentGlow,
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
  detectedText: {
    color: TRUST_COLORS.softWhite,
    fontSize: 13,
    letterSpacing: 0.2,
  },
});

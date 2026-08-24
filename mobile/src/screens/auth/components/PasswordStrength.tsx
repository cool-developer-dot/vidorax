import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';
import {
  evaluatePassword,
  type PasswordRuleId,
  type PasswordStrengthLevel,
} from '../validation';

type PasswordStrengthProps = {
  password: string;
};

const SEGMENT_COUNT = 5;

function levelLabelKey(
  level: PasswordStrengthLevel,
): 'auth.validation.strengthWeak' | 'auth.validation.strengthMedium' | 'auth.validation.strengthStrong' | null {
  switch (level) {
    case 'weak':
      return 'auth.validation.strengthWeak';
    case 'medium':
      return 'auth.validation.strengthMedium';
    case 'strong':
      return 'auth.validation.strengthStrong';
    default:
      return null;
  }
}

function ruleLabelKey(
  id: PasswordRuleId,
):
  | 'auth.validation.ruleLength'
  | 'auth.validation.ruleUpper'
  | 'auth.validation.ruleLower'
  | 'auth.validation.ruleNumber'
  | 'auth.validation.ruleSpecial' {
  switch (id) {
    case 'length':
      return 'auth.validation.ruleLength';
    case 'upper':
      return 'auth.validation.ruleUpper';
    case 'lower':
      return 'auth.validation.ruleLower';
    case 'number':
      return 'auth.validation.ruleNumber';
    default:
      return 'auth.validation.ruleSpecial';
  }
}

function levelColor(level: PasswordStrengthLevel): string {
  switch (level) {
    case 'weak':
      return AUTH_COLORS.strengthWeak;
    case 'medium':
      return AUTH_COLORS.strengthMedium;
    case 'strong':
      return AUTH_COLORS.strengthStrong;
    default:
      return AUTH_COLORS.strengthTrack;
  }
}

const StrengthSegment = memo(function StrengthSegment({
  active,
  color,
}: {
  active: boolean;
  color: string;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + progress.value * 0.75,
    transform: [{ scaleY: 0.85 + progress.value * 0.15 }],
    backgroundColor: active ? color : AUTH_COLORS.strengthTrack,
  }));

  return <Animated.View style={[styles.segment, style]} />;
});

const RuleRow = memo(function RuleRow({
  label,
  met,
}: {
  label: string;
  met: boolean;
}) {
  const progress = useSharedValue(met ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(met ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [met, progress]);

  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.7 + progress.value * 0.3 }],
  }));

  return (
    <View style={styles.ruleRow}>
      <View
        style={[
          styles.ruleDot,
          {
            borderColor: met ? AUTH_COLORS.success : AUTH_COLORS.checkboxBorder,
            backgroundColor: met ? AUTH_COLORS.success : 'transparent',
          },
        ]}>
        <Animated.View style={checkStyle}>
          <Check size={10} color="#FFFFFF" strokeWidth={2.6} />
        </Animated.View>
      </View>
      <Text
        style={[
          styles.ruleLabel,
          {
            fontFamily: fontFamilies.body,
            color: met ? AUTH_COLORS.title : AUTH_COLORS.muted,
          },
        ]}
        maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
        {label}
      </Text>
    </View>
  );
});

/**
 * Animated password strength meter + live requirement checklist.
 */
export const PasswordStrength = memo(function PasswordStrength({
  password,
}: PasswordStrengthProps) {
  const { t } = useTranslation();
  const evaluation = useMemo(() => evaluatePassword(password), [password]);
  const color = levelColor(evaluation.level);
  const filled = evaluation.level === 'empty' ? 0 : Math.max(1, evaluation.score);
  const strengthKey = levelLabelKey(evaluation.level);
  const strengthLabel = strengthKey ? t(strengthKey) : '';

  if (!password) {
    return null;
  }

  return (
    <View
      style={styles.root}
      accessibilityLabel={strengthLabel}>
      <View style={styles.header}>
        <Text
          style={[styles.level, { fontFamily: fontFamilies.bodySemiBold, color }]}
          maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
          {strengthLabel}
        </Text>
        <View style={styles.segments}>
          {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
            <StrengthSegment key={index} active={index < filled} color={color} />
          ))}
        </View>
      </View>

      <View style={styles.rules}>
        {evaluation.checks.map((rule) => (
          <RuleRow
            key={rule.id}
            label={t(ruleLabelKey(rule.id), rule.id === 'length' ? { count: 8 } : undefined)}
            met={rule.met}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    gap: 10,
    marginTop: -4,
    paddingHorizontal: 2,
  },
  header: {
    gap: 8,
  },
  level: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  rules: {
    gap: 6,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 22,
  },
  ruleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleLabel: {
    fontSize: 12,
    letterSpacing: 0.15,
  },
});

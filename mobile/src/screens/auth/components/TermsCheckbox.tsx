import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Pressable } from '@/components/base/Pressable';
import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';

type TermsCheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  error?: string;
  onPressTerms?: () => void;
  onPressPrivacy?: () => void;
};

export const TermsCheckbox = memo(function TermsCheckbox({
  checked,
  onChange,
  disabled = false,
  error,
  onPressTerms,
  onPressPrivacy,
}: TermsCheckboxProps) {
  const { t } = useTranslation();
  const progress = useSharedValue(checked ? 1 : 0);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [checked, progress]);

  useEffect(() => {
    if (!error) {
      return;
    }
    shakeX.value = withSequence(
      withTiming(-5, { duration: 45 }),
      withTiming(5, { duration: 45 }),
      withTiming(-3, { duration: 45 }),
      withTiming(3, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    );
  }, [error, shakeX]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor:
      progress.value > 0.5 ? AUTH_COLORS.checkboxFill : 'transparent',
    borderColor:
      progress.value > 0.5 ? AUTH_COLORS.checkboxFill : AUTH_COLORS.checkboxBorder,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.7 + progress.value * 0.3 }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <Animated.View style={rowStyle}>
      <View style={[styles.row, disabled && styles.disabled]}>
        <Pressable
          disabled={disabled}
          onPress={() => onChange(!checked)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled }}
          accessibilityLabel={t('auth.termsA11y')}
          style={styles.checkboxHit}>
          <Animated.View style={[styles.box, boxStyle]}>
            <Animated.View style={checkStyle}>
              <Check size={12} color="#FFFFFF" strokeWidth={2.6} />
            </Animated.View>
          </Animated.View>
        </Pressable>

        <Text
          style={[styles.text, { fontFamily: fontFamilies.body }]}
          maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
          {t('auth.termsPrefix')}
          <Text
            onPress={disabled ? undefined : onPressTerms}
            style={[styles.link, { fontFamily: fontFamilies.bodySemiBold }]}
            accessibilityRole="link"
            accessibilityLabel={t('auth.termsLink')}>
            {t('auth.termsLink')}
          </Text>
          {t('auth.termsMiddle')}
          <Text
            onPress={disabled ? undefined : onPressPrivacy}
            style={[styles.link, { fontFamily: fontFamilies.bodySemiBold }]}
            accessibilityRole="link"
            accessibilityLabel={t('auth.privacyLink')}>
            {t('auth.privacyLink')}
          </Text>
          {t('auth.termsSuffix')}
        </Text>
      </View>

      {error ? (
        <Text
          style={[styles.error, { fontFamily: fontFamilies.body }]}
          maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
          {error}
        </Text>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 44,
  },
  disabled: {
    opacity: 0.55,
  },
  checkboxHit: {
    paddingTop: 2,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    color: AUTH_COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.15,
  },
  link: {
    color: AUTH_COLORS.accent,
  },
  error: {
    marginTop: 6,
    marginLeft: 30,
    color: AUTH_COLORS.error,
    fontSize: 12,
    lineHeight: 16,
  },
});

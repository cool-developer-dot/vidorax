import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Pressable } from '@/components/base/Pressable';
import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';

type RememberMeProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export const RememberMe = memo(function RememberMe({
  checked,
  onChange,
  disabled = false,
}: RememberMeProps) {
  const { t } = useTranslation();
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [checked, progress]);

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

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={t('auth.rememberMe')}
      style={[styles.row, disabled && styles.disabled]}>
      <Animated.View style={[styles.box, boxStyle]}>
        <Animated.View style={checkStyle}>
          <Check size={12} color="#FFFFFF" strokeWidth={2.6} />
        </Animated.View>
      </Animated.View>
      <Text
        style={[styles.label, { fontFamily: fontFamilies.body }]}
        maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
        {t('auth.rememberMe')}
      </Text>
      {/* Keep View for layout stability on web */}
      <View />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingRight: 8,
  },
  disabled: {
    opacity: 0.55,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: AUTH_COLORS.muted,
    fontSize: 13,
    letterSpacing: 0.15,
  },
});

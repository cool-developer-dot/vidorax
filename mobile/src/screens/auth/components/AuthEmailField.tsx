import { memo, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Check } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fontFamilies } from '@/theme/typography';
import { useTranslation } from '@/localization';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';

type AuthEmailFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  error?: string;
  isValid?: boolean;
  disabled?: boolean;
};

/**
 * Premium floating-label email field with focus glow + success check.
 */
export const AuthEmailField = memo(function AuthEmailField({
  label,
  error,
  isValid = false,
  disabled = false,
  value,
  onChangeText,
  onFocus,
  onBlur,
  placeholder,
  ...rest
}: AuthEmailFieldProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const float = useSharedValue(value ? 1 : 0);
  const shakeX = useSharedValue(0);
  const focusGlow = useSharedValue(0);

  const hasValue = Boolean(value && String(value).length > 0);
  const floated = focused || hasValue;

  useEffect(() => {
    float.value = withTiming(floated ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [float, floated]);

  useEffect(() => {
    focusGlow.value = withTiming(focused && !error ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [error, focusGlow, focused]);

  useEffect(() => {
    if (!error) {
      return;
    }
    shakeX.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [error, shakeX]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - float.value) * 10 + float.value * -10 },
      { scale: 1 - float.value * 0.12 },
    ],
    opacity: 0.7 + float.value * 0.3,
  }));

  const fieldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
    shadowColor: AUTH_COLORS.inputBorderFocus,
    shadowOpacity: focusGlow.value * 0.35,
    shadowRadius: 8 + focusGlow.value * 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: focusGlow.value > 0.5 ? 2 : 0,
  }));

  const borderColor = error
    ? AUTH_COLORS.inputBorderError
    : focused
      ? AUTH_COLORS.inputBorderFocus
      : isValid
        ? AUTH_COLORS.inputBorderSuccess
        : AUTH_COLORS.inputBorder;

  return (
    <Animated.View style={fieldStyle}>
      <View
        style={[
          styles.field,
          {
            borderColor,
            opacity: disabled ? 0.55 : 1,
          },
        ]}>
        <Animated.View pointerEvents="none" style={[styles.labelWrap, labelStyle]}>
          <Text
            style={[
              styles.label,
              {
                fontFamily: fontFamilies.body,
                color: focused
                  ? AUTH_COLORS.labelActive
                  : error
                    ? AUTH_COLORS.error
                    : AUTH_COLORS.label,
              },
            ]}
            maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
            {label}
          </Text>
        </Animated.View>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          placeholder={floated ? placeholder : undefined}
          placeholderTextColor={AUTH_COLORS.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          importantForAutofill="yes"
          returnKeyType="next"
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          style={[styles.input, { fontFamily: fontFamilies.body }]}
          maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}
          {...rest}
        />

        {isValid && !error ? (
          <View style={styles.success} accessibilityLabel={t('auth.emailValidA11y')}>
            <Check size={16} color={AUTH_COLORS.success} strokeWidth={2.4} />
          </View>
        ) : null}
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
  field: {
    minHeight: AUTH_LAYOUT.fieldHeight,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    backgroundColor: AUTH_COLORS.inputBg,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    justifyContent: 'flex-end',
  },
  labelWrap: {
    position: 'absolute',
    left: 16,
    top: 18,
  },
  label: {
    fontSize: 14,
    letterSpacing: 0.15,
  },
  input: {
    color: AUTH_COLORS.inputText,
    fontSize: 15,
    lineHeight: 20,
    padding: 0,
    margin: 0,
    paddingRight: 28,
  },
  success: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  error: {
    marginTop: 6,
    marginLeft: 4,
    color: AUTH_COLORS.error,
    fontSize: 12,
    lineHeight: 16,
  },
});

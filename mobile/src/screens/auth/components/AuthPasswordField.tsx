import { memo, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Pressable } from '@/components/base/Pressable';
import { fontFamilies } from '@/theme/typography';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';

type AuthPasswordFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  error?: string;
  isValid?: boolean;
  disabled?: boolean;
};

/**
 * Premium floating-label password field with animated show/hide.
 */
export const AuthPasswordField = memo(function AuthPasswordField({
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
}: AuthPasswordFieldProps) {
  const [focused, setFocused] = useState(false);
  const [secure, setSecure] = useState(true);
  const float = useSharedValue(value ? 1 : 0);
  const shakeX = useSharedValue(0);
  const eyeScale = useSharedValue(1);
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

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: eyeScale.value }],
  }));

  const borderColor = error
    ? AUTH_COLORS.inputBorderError
    : focused
      ? AUTH_COLORS.inputBorderFocus
      : isValid
        ? AUTH_COLORS.inputBorderSuccess
        : AUTH_COLORS.inputBorder;

  const EyeIcon = secure ? EyeOff : Eye;

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
          secureTextEntry={secure}
          placeholder={floated ? placeholder : undefined}
          placeholderTextColor={AUTH_COLORS.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
          importantForAutofill="yes"
          returnKeyType="done"
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

        <Animated.View style={[styles.eye, eyeStyle]}>
          <Pressable
            disabled={disabled}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={secure ? 'Show password' : 'Hide password'}
            onPress={() => {
              eyeScale.value = withSequence(
                withTiming(0.86, { duration: 90 }),
                withTiming(1, { duration: 140 }),
              );
              setSecure((current) => !current);
            }}
            style={styles.eyeHit}>
            <EyeIcon size={18} color={AUTH_COLORS.muted} strokeWidth={2} />
          </Pressable>
        </Animated.View>
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
    paddingRight: 40,
  },
  eye: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
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

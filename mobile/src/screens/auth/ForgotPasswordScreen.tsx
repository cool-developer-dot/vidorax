import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '@/components/base/Pressable';
import { localizeAuthValidationCode, useTranslation } from '@/localization';
import { replace } from '@/navigation/helpers/navigation';
import { routePaths } from '@/navigation/constants/route-paths';
import { useAuthBackHandler } from '@/navigation/hooks/use-auth-back-handler';
import { fontFamilies } from '@/theme/typography';

import {
  AuthBackground,
  AuthEmailField,
  AuthHeader,
  ForgotPasswordSuccess,
  PrimaryAuthButton,
} from './components';
import { AUTH_COLORS, AUTH_LAYOUT } from './constants';
import { useForgotPassword } from './hooks/useForgotPassword';
import { authStyles } from './styles';
import {
  FORGOT_PASSWORD_DEFAULT_VALUES,
  forgotPasswordSchema,
  getForgotPasswordEmailError,
  type ForgotPasswordFormValues,
} from './validation';

/**
 * Premium Forgot Password — UI phase (no backend).
 * Swap `useForgotPassword` internals later for POST /auth/forgot-password.
 */
export const ForgotPasswordScreen = memo(function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { loading, success, submit } = useForgotPassword();

  useAuthBackHandler();

  const [email, setEmail] = useState(FORGOT_PASSWORD_DEFAULT_VALUES.email);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  const emailValid = useMemo(() => !getForgotPasswordEmailError(email), [email]);

  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(14);

  useEffect(() => {
    formOpacity.value = withDelay(
      220,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    formTranslateY.value = withDelay(
      220,
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
  }, [formOpacity, formTranslateY]);

  const formStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

  const goSignIn = useCallback(() => {
    if (loading) {
      return;
    }
    replace(routePaths.signIn);
  }, [loading]);

  const onSubmit = useCallback(() => {
    const values: ForgotPasswordFormValues = { email: email.trim() };
    const parsed = forgotPasswordSchema.safeParse(values);

    setTouched(true);

    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message;
      setError(code ? localizeAuthValidationCode(code) : undefined);
      return;
    }

    setError(undefined);
    void submit(parsed.data);
  }, [email, submit]);

  return (
    <View
      style={authStyles.root}
      testID="forgot-password-screen"
      accessibilityLabel={t('auth.forgotA11y')}>
      <StatusBar barStyle="light-content" backgroundColor={AUTH_COLORS.background} />
      <AuthBackground />

      <KeyboardAvoidingView
        style={authStyles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          contentContainerStyle={[
            authStyles.scroll,
            {
              paddingTop: Math.max(insets.top, 24) + 12,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={authStyles.content}>
            <AuthHeader
              title={t('auth.forgotTitle')}
              subtitle={t('auth.forgotSubtitle')}
            />

            <Animated.View style={[authStyles.form, formStyle]}>
              {success ? (
                <ForgotPasswordSuccess onBackToLogin={goSignIn} />
              ) : (
                <>
                  <AuthEmailField
                    label={t('auth.emailLabel')}
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChangeText={(text) => {
                      const next = text.replace(/\s+/g, '');
                      setEmail(next);
                      if (touched) {
                        setError(getForgotPasswordEmailError(next));
                      }
                    }}
                    onBlur={() => {
                      setTouched(true);
                      setError(getForgotPasswordEmailError(email));
                    }}
                    error={touched ? error : undefined}
                    isValid={emailValid}
                    disabled={loading}
                    onSubmitEditing={onSubmit}
                    returnKeyType="done"
                  />

                  <PrimaryAuthButton
                    title={t('auth.sendResetLink')}
                    loading={loading}
                    disabled={loading}
                    onPress={onSubmit}
                  />

                  <Pressable
                    disabled={loading}
                    onPress={goSignIn}
                    hitSlop={10}
                    accessibilityRole="link"
                    accessibilityLabel={t('auth.backToLogin')}
                    pressedOpacity={0.7}
                    style={styles.backHit}>
                    <Text
                      style={[styles.backLabel, { fontFamily: fontFamilies.bodySemiBold }]}
                      maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
                      {t('auth.backToLogin')}
                    </Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
});

const styles = {
  backHit: {
    minHeight: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 4,
  },
  backLabel: {
    color: AUTH_COLORS.accent,
    fontSize: 15,
    letterSpacing: 0.2,
  },
};

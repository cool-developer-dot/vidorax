import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '@/localization';
import { push } from '@/navigation/helpers/navigation';
import { routePaths } from '@/navigation/constants/route-paths';
import { fontFamilies } from '@/theme/typography';

import {
  AuthDivider,
  AuthEmailField,
  AuthFooter,
  AuthPasswordField,
  ForgotPasswordLink,
  PrimaryAuthButton,
  RememberMe,
} from '../components';
import { AUTH_LAYOUT } from '../constants';
import { useLogin } from '../hooks';
import { AuthStaggerItem } from '../motion';
import { authStyles } from '../styles';
import {
  LOGIN_DEFAULT_VALUES,
  getLoginFieldError,
  loginSchema,
  type LoginFormValues,
} from '../validation';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

function validateForm(values: LoginFormValues): FieldErrors {
  const parsed = loginSchema.safeParse(values);
  if (parsed.success) {
    return {};
  }

  return {
    email: getLoginFieldError('email', values.email),
    password: getLoginFieldError('password', values.password),
  };
}

export type SignInFormProps = {
  /** Blocks footer switch + field edits while the card is flipping. */
  interactionLocked?: boolean;
  onCreateAccount: () => void;
};

/**
 * Sign-in form face — preserves useLogin, validation, and field UX.
 * Presentation only; the parent owns the 3D flip shell.
 */
export const SignInForm = memo(function SignInForm({
  interactionLocked = false,
  onCreateAccount,
}: SignInFormProps) {
  const { t } = useTranslation();
  const { loading, formError, clearFormError, submit, defaultRememberMe } = useLogin();

  const [email, setEmail] = useState(LOGIN_DEFAULT_VALUES.email);
  const [password, setPassword] = useState(LOGIN_DEFAULT_VALUES.password);
  const [rememberMe, setRememberMe] = useState(defaultRememberMe ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState({ email: false, password: false });

  const disabled = loading || interactionLocked;
  const emailValid = useMemo(() => !getLoginFieldError('email', email), [email]);

  const errorShake = useSharedValue(0);

  useEffect(() => {
    if (!formError) {
      return;
    }
    errorShake.value = withSequence(
      withTiming(-5, { duration: 45 }),
      withTiming(5, { duration: 45 }),
      withTiming(-3, { duration: 45 }),
      withTiming(3, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    );
  }, [errorShake, formError]);

  const errorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: errorShake.value }],
  }));

  const onSubmit = useCallback(() => {
    if (interactionLocked) {
      return;
    }

    const values: LoginFormValues = {
      email: email.trim(),
      password,
      rememberMe,
    };

    const nextErrors = validateForm(values);
    setTouched({ email: true, password: true });
    setErrors(nextErrors);

    if (nextErrors.email || nextErrors.password) {
      return;
    }

    void submit(values);
  }, [email, interactionLocked, password, rememberMe, submit]);

  const goForgotPassword = useCallback(() => {
    if (disabled) {
      return;
    }
    push(routePaths.forgotPassword);
  }, [disabled]);

  const handleCreateAccount = useCallback(() => {
    if (disabled) {
      return;
    }
    onCreateAccount();
  }, [disabled, onCreateAccount]);

  return (
    <View style={authStyles.form} testID="sign-in-form-face">
      <AuthStaggerItem step="firstField">
        <AuthEmailField
          label={t('auth.emailLabel')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={(text) => {
            clearFormError();
            const next = text.replace(/\s+/g, '');
            setEmail(next);
            if (touched.email) {
              setErrors((current) => ({
                ...current,
                email: getLoginFieldError('email', next),
              }));
            }
          }}
          onBlur={() => {
            setTouched((current) => ({ ...current, email: true }));
            setErrors((current) => ({
              ...current,
              email: getLoginFieldError('email', email),
            }));
          }}
          error={touched.email ? errors.email : undefined}
          isValid={emailValid}
          disabled={disabled}
        />
      </AuthStaggerItem>

      <AuthStaggerItem step="remaining">
        <View style={{ gap: 16 }}>
          <AuthPasswordField
            label={t('auth.passwordLabel')}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChangeText={(text) => {
              clearFormError();
              setPassword(text);
              if (touched.password) {
                setErrors((current) => ({
                  ...current,
                  password: getLoginFieldError('password', text),
                }));
              }
            }}
            onBlur={() => {
              setTouched((current) => ({ ...current, password: true }));
              setErrors((current) => ({
                ...current,
                password: getLoginFieldError('password', password),
              }));
            }}
            error={touched.password ? errors.password : undefined}
            isValid={Boolean(password) && !errors.password}
            disabled={disabled}
            onSubmitEditing={onSubmit}
          />

          <View style={authStyles.rowBetween}>
            <RememberMe
              checked={rememberMe}
              onChange={setRememberMe}
              disabled={disabled}
            />
            <ForgotPasswordLink disabled={disabled} onPress={goForgotPassword} />
          </View>

          {formError ? (
            <Animated.View
              style={errorStyle}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              <Text
                style={[authStyles.formError, { fontFamily: fontFamilies.body }]}
                maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
                {formError}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </AuthStaggerItem>

      <AuthStaggerItem step="button">
        <PrimaryAuthButton
          title={t('auth.signIn')}
          loading={loading}
          disabled={disabled}
          onPress={onSubmit}
        />
      </AuthStaggerItem>

      <AuthStaggerItem step="footer">
        <View style={{ gap: 16 }}>
          <AuthDivider />
          <AuthFooter
            disabled={disabled}
            prompt={t('auth.noAccount')}
            actionLabel={t('auth.createAccount')}
            onAction={handleCreateAccount}
          />
        </View>
      </AuthStaggerItem>
    </View>
  );
});

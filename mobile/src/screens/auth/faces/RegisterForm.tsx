import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { appStoreConfig } from '@/constants/app-identity';
import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';
import { openExternalUrl } from '@/utils/open-external-url';

import {
  AuthDivider,
  AuthEmailField,
  AuthFooter,
  AuthNameField,
  AuthPasswordField,
  PasswordStrength,
  PrimaryAuthButton,
  TermsCheckbox,
} from '../components';
import { AUTH_LAYOUT } from '../constants';
import { useRegister } from '../hooks';
import { AuthStaggerItem } from '../motion';
import { authStyles } from '../styles';
import {
  REGISTER_DEFAULT_VALUES,
  evaluatePassword,
  getRegisterFieldError,
  normalizeFullName,
  registerSchema,
  type RegisterFormValues,
} from '../validation';

type FieldKey = 'name' | 'email' | 'password' | 'confirmPassword' | 'acceptedTerms';
type FieldErrors = Partial<Record<FieldKey, string>>;

function validateForm(values: RegisterFormValues): FieldErrors {
  const parsed = registerSchema.safeParse(values);
  if (parsed.success) {
    return {};
  }

  const next: FieldErrors = {};
  for (const field of [
    'name',
    'email',
    'password',
    'confirmPassword',
    'acceptedTerms',
  ] as const) {
    const message = getRegisterFieldError(field, values);
    if (message) {
      next[field] = message;
    }
  }
  return next;
}

export type RegisterFormProps = {
  /** Blocks footer switch + field edits while the card is flipping. */
  interactionLocked?: boolean;
  onSignIn: () => void;
};

/**
 * Register form face — preserves useRegister, validation, and field UX.
 * Presentation only; the parent owns the 3D flip shell.
 */
export const RegisterForm = memo(function RegisterForm({
  interactionLocked = false,
  onSignIn,
}: RegisterFormProps) {
  const { t } = useTranslation();
  const { loading, formError, clearFormError, submit } = useRegister();

  const [name, setName] = useState(REGISTER_DEFAULT_VALUES.name);
  const [email, setEmail] = useState(REGISTER_DEFAULT_VALUES.email);
  const [password, setPassword] = useState(REGISTER_DEFAULT_VALUES.password);
  const [confirmPassword, setConfirmPassword] = useState(
    REGISTER_DEFAULT_VALUES.confirmPassword,
  );
  const [acceptedTerms, setAcceptedTerms] = useState(
    REGISTER_DEFAULT_VALUES.acceptedTerms,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
    acceptedTerms: false,
  });

  const disabled = loading || interactionLocked;

  const values = useMemo<RegisterFormValues>(
    () => ({
      name,
      email,
      password,
      confirmPassword,
      acceptedTerms,
    }),
    [acceptedTerms, confirmPassword, email, name, password],
  );

  const nameValid = useMemo(
    () => !getRegisterFieldError('name', { name: normalizeFullName(name) }),
    [name],
  );
  const emailValid = useMemo(() => !getRegisterFieldError('email', { email }), [email]);
  const passwordEval = useMemo(() => evaluatePassword(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

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

  const markTouched = useCallback((field: FieldKey) => {
    setTouched((current) => ({ ...current, [field]: true }));
  }, []);

  const onSubmit = useCallback(() => {
    if (interactionLocked) {
      return;
    }

    const nextValues: RegisterFormValues = {
      name: normalizeFullName(name),
      email: email.trim(),
      password,
      confirmPassword,
      acceptedTerms,
    };

    const nextErrors = validateForm(nextValues);
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      acceptedTerms: true,
    });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    void submit(nextValues);
  }, [
    acceptedTerms,
    confirmPassword,
    email,
    interactionLocked,
    name,
    password,
    submit,
  ]);

  const handleSignIn = useCallback(() => {
    if (disabled) {
      return;
    }
    onSignIn();
  }, [disabled, onSignIn]);

  const openLegalLink = useCallback(async (kind: 'terms' | 'privacy') => {
    const url =
      kind === 'terms' ? appStoreConfig.termsUrl : appStoreConfig.privacyUrl;
    // Non-blocking — registration must remain usable offline.
    await openExternalUrl(url);
  }, []);

  return (
    <View style={authStyles.form} testID="register-form-face">
      <AuthStaggerItem step="firstField">
        <AuthNameField
          label={t('auth.nameLabel')}
          placeholder={t('auth.namePlaceholder')}
          value={name}
          onChangeText={(text) => {
            clearFormError();
            setName(text);
            if (touched.name) {
              setErrors((current) => ({
                ...current,
                name: getRegisterFieldError('name', {
                  ...values,
                  name: text,
                }),
              }));
            }
          }}
          onBlur={() => {
            const normalized = normalizeFullName(name);
            setName(normalized);
            markTouched('name');
            setErrors((current) => ({
              ...current,
              name: getRegisterFieldError('name', {
                ...values,
                name: normalized,
              }),
            }));
          }}
          error={touched.name ? errors.name : undefined}
          isValid={nameValid && name.trim().length > 0}
          disabled={disabled}
        />
      </AuthStaggerItem>

      <AuthStaggerItem step="remaining">
        <View style={{ gap: 16 }}>
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
                  email: getRegisterFieldError('email', {
                    ...values,
                    email: next,
                  }),
                }));
              }
            }}
            onBlur={() => {
              markTouched('email');
              setErrors((current) => ({
                ...current,
                email: getRegisterFieldError('email', values),
              }));
            }}
            error={touched.email ? errors.email : undefined}
            isValid={emailValid}
            disabled={disabled}
          />

          <AuthPasswordField
            label={t('auth.passwordLabel')}
            placeholder={t('auth.createPasswordPlaceholder')}
            value={password}
            onChangeText={(text) => {
              clearFormError();
              setPassword(text);
              if (touched.password) {
                setErrors((current) => ({
                  ...current,
                  password: getRegisterFieldError('password', {
                    ...values,
                    password: text,
                  }),
                }));
              }
              if (touched.confirmPassword) {
                setErrors((current) => ({
                  ...current,
                  confirmPassword: getRegisterFieldError('confirmPassword', {
                    ...values,
                    password: text,
                  }),
                }));
              }
            }}
            onBlur={() => {
              markTouched('password');
              setErrors((current) => ({
                ...current,
                password: getRegisterFieldError('password', values),
              }));
            }}
            error={touched.password ? errors.password : undefined}
            isValid={passwordEval.isStrong}
            disabled={disabled}
            textContentType="newPassword"
            autoComplete="password-new"
          />

          <PasswordStrength password={password} />

          <AuthPasswordField
            label={t('auth.confirmLabel')}
            placeholder={t('auth.confirmPlaceholder')}
            value={confirmPassword}
            onChangeText={(text) => {
              clearFormError();
              setConfirmPassword(text);
              if (touched.confirmPassword) {
                setErrors((current) => ({
                  ...current,
                  confirmPassword: getRegisterFieldError('confirmPassword', {
                    ...values,
                    confirmPassword: text,
                  }),
                }));
              }
            }}
            onBlur={() => {
              markTouched('confirmPassword');
              setErrors((current) => ({
                ...current,
                confirmPassword: getRegisterFieldError('confirmPassword', values),
              }));
            }}
            error={touched.confirmPassword ? errors.confirmPassword : undefined}
            isValid={passwordsMatch}
            disabled={disabled}
            textContentType="newPassword"
            autoComplete="password-new"
            onSubmitEditing={onSubmit}
          />

          <TermsCheckbox
            checked={acceptedTerms}
            disabled={disabled}
            error={touched.acceptedTerms ? errors.acceptedTerms : undefined}
            onChange={(next) => {
              clearFormError();
              setAcceptedTerms(next);
              markTouched('acceptedTerms');
              setErrors((current) => ({
                ...current,
                acceptedTerms: getRegisterFieldError('acceptedTerms', {
                  ...values,
                  acceptedTerms: next,
                }),
              }));
            }}
            onPressTerms={() => {
              void openLegalLink('terms');
            }}
            onPressPrivacy={() => {
              void openLegalLink('privacy');
            }}
          />

          {formError ? (
            <Animated.View
              style={errorStyle}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              <Text
                style={[authStyles.formError, { fontFamily: fontFamilies.body }]}
                maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
                {formError.message}
              </Text>
              {formError.code === 'CONFLICT' ? (
                <Text
                  onPress={handleSignIn}
                  style={[
                    authStyles.footerLink,
                    {
                      fontFamily: fontFamilies.bodySemiBold,
                      textAlign: 'center',
                      marginTop: 8,
                    },
                  ]}
                  accessibilityRole="link"
                  accessibilityLabel={t('auth.signInInstead')}>
                  {t('auth.signInInstead')}
                </Text>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      </AuthStaggerItem>

      <AuthStaggerItem step="button">
        <PrimaryAuthButton
          title={t('auth.createAccount')}
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
            prompt={t('auth.hasAccount')}
            actionLabel={t('auth.signIn')}
            onAction={handleSignIn}
          />
        </View>
      </AuthStaggerItem>
    </View>
  );
});

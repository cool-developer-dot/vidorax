import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthBackHandler } from '@/navigation/hooks/use-auth-back-handler';
import { useReducedMotionPreference } from '@/screens/splash/hooks/useReducedMotionPreference';

import { useTranslation } from '@/localization';

import { AuthBackground, AuthHeader, AuthenticationFlipContainer } from './components';
import { AUTH_COLORS } from './constants';
import type { AuthCredentialFace } from './constants/auth-flip.constants';
import { RegisterForm, SignInForm } from './faces';
import {
  AuthFaceRevealProvider,
  triggerAuthFlipSettleHaptic,
} from './motion';
import { authStyles } from './styles';

function faceFromPathname(pathname: string): AuthCredentialFace {
  return pathname.includes('sign-up') ? 'sign-up' : 'sign-in';
}

function pathForFace(face: AuthCredentialFace): '/sign-in' | '/sign-up' {
  return face === 'sign-up' ? '/sign-up' : '/sign-in';
}

/**
 * Shared Sign In ↔ Create Account experience.
 * Stable luxury background + one glass card that flips in 3D.
 */
export const AuthCredentialScreen = memo(function AuthCredentialScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotionPreference();
  const { t } = useTranslation();

  useAuthBackHandler();

  const routeFace = faceFromPathname(pathname);
  const [face, setFace] = useState<AuthCredentialFace>(routeFace);
  const [flipping, setFlipping] = useState(false);
  const [frontRevealKey, setFrontRevealKey] = useState(
    () => (routeFace === 'sign-in' ? 1 : 0),
  );
  const [backRevealKey, setBackRevealKey] = useState(
    () => (routeFace === 'sign-up' ? 1 : 0),
  );
  const syncingRouteRef = useRef(false);

  useEffect(() => {
    if (syncingRouteRef.current) {
      return;
    }
    setFace((current) => (current === routeFace ? current : routeFace));
  }, [routeFace]);

  const entranceOpacity = useSharedValue(0);
  const entranceTranslateY = useSharedValue(12);

  useEffect(() => {
    if (reduceMotion) {
      entranceOpacity.value = 1;
      entranceTranslateY.value = 0;
      return;
    }

    entranceOpacity.value = withDelay(
      120,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
    entranceTranslateY.value = withDelay(
      120,
      withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
  }, [entranceOpacity, entranceTranslateY, reduceMotion]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [{ translateY: entranceTranslateY.value }],
  }));

  const syncRoute = useCallback(
    (next: AuthCredentialFace) => {
      if (faceFromPathname(pathname) === next) {
        syncingRouteRef.current = false;
        return;
      }

      syncingRouteRef.current = true;
      router.replace(pathForFace(next));
      requestAnimationFrame(() => {
        syncingRouteRef.current = false;
      });
    },
    [pathname, router],
  );

  const requestFace = useCallback(
    (next: AuthCredentialFace) => {
      if (flipping || next === face) {
        return;
      }
      setFlipping(true);
      setFace(next);
      syncRoute(next);
    },
    [face, flipping, syncRoute],
  );

  const onFlipSettled = useCallback((next: AuthCredentialFace) => {
    setFlipping(false);

    if (next === 'sign-up') {
      setBackRevealKey((key) => key + 1);
    } else {
      setFrontRevealKey((key) => key + 1);
    }

    const label =
      next === 'sign-up' ? t('auth.signUpA11y') : t('auth.signInA11y');
    void AccessibilityInfo.announceForAccessibility(label);
    void triggerAuthFlipSettleHaptic();
  }, [t]);

  const goCreateAccount = useCallback(() => {
    requestFace('sign-up');
  }, [requestFace]);

  const goSignIn = useCallback(() => {
    requestFace('sign-in');
  }, [requestFace]);

  const accessibilityLabel = useMemo(
    () =>
      face === 'sign-up' ? t('auth.signUpA11y') : t('auth.signInA11y'),
    [face, t],
  );

  const frontReveal = useMemo(
    () => ({
      revealKey: frontRevealKey,
      active: face === 'sign-in' && !flipping,
      reduceMotion,
      face: 'sign-in' as const,
    }),
    [face, flipping, frontRevealKey, reduceMotion],
  );

  const backReveal = useMemo(
    () => ({
      revealKey: backRevealKey,
      active: face === 'sign-up' && !flipping,
      reduceMotion,
      face: 'sign-up' as const,
    }),
    [backRevealKey, face, flipping, reduceMotion],
  );

  return (
    <View
      style={authStyles.root}
      testID={face === 'sign-up' ? 'register-screen' : 'login-screen'}
      accessibilityLabel={accessibilityLabel}>
      <StatusBar barStyle="light-content" backgroundColor={AUTH_COLORS.background} />
      <AuthBackground enabled={!reduceMotion} />

      <KeyboardAvoidingView
        style={authStyles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          contentContainerStyle={[
            authStyles.scroll,
            {
              justifyContent: face === 'sign-up' ? 'flex-start' : 'center',
              paddingTop: Math.max(insets.top, 20) + 8,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={!flipping}>
          <Animated.View style={[authStyles.content, entranceStyle]}>
            <AuthenticationFlipContainer
              face={face}
              reduceMotion={reduceMotion}
              onFlipSettled={onFlipSettled}
              front={
                <AuthFaceRevealProvider value={frontReveal}>
                  <View>
                    <AuthHeader
                      enabled={false}
                      title={t('auth.signInTitle')}
                      subtitle={t('auth.signInSubtitle')}
                    />
                    <SignInForm
                      interactionLocked={flipping}
                      onCreateAccount={goCreateAccount}
                    />
                  </View>
                </AuthFaceRevealProvider>
              }
              back={
                <AuthFaceRevealProvider value={backReveal}>
                  <View>
                    <AuthHeader
                      enabled={false}
                      title={t('auth.signUpTitle')}
                      subtitle={t('auth.signUpSubtitle')}
                    />
                    <RegisterForm interactionLocked={flipping} onSignIn={goSignIn} />
                  </View>
                </AuthFaceRevealProvider>
              }
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
});

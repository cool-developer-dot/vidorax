import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, StatusBar, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolvePostSplashRoute } from '@/navigation/helpers/resolve-post-splash-route';
import { useAuthBackHandler } from '@/navigation/hooks/use-auth-back-handler';
import { useTranslation } from '@/localization';
import {
  selectAppInitialized,
  selectAppLoading,
  useAppStore,
} from '@/store/app';

import { useSplashSequence } from './animations';
import { SPLASH_REDUCED_MOTION, SPLASH_TIMINGS } from './animations/timings';
import { SplashBackground, SplashBrand, SplashLoader, SplashLogo, SplashTagline } from './components';
import { SPLASH_COLORS } from './constants';
import { useReducedMotionPreference, useSplashExitGate } from './hooks';
import { splashStyles } from './styles';

/**
 * Cinematic branded loader — first surface on every cold start.
 * Blocks interaction until exit gate (init complete + min duration).
 */
export function SplashScreen() {
  const { t } = useTranslation();
  useAuthBackHandler();
  const insets = useSafeAreaInsets();
  const hasNavigatedRef = useRef(false);
  const reducedMotion = useReducedMotionPreference();

  const isInitialized = useAppStore(selectAppInitialized);
  const isLoading = useAppStore(selectAppLoading);
  const isInitializationComplete = isInitialized && !isLoading;

  const sequence = useSplashSequence({ reducedMotion });
  const { playExit } = sequence;

  const navigateAway = useCallback(() => {
    if (hasNavigatedRef.current) {
      return;
    }
    hasNavigatedRef.current = true;
    router.replace(resolvePostSplashRoute() as Href);
  }, []);

  const handleReadyToExit = useCallback(() => {
    playExit(navigateAway);
  }, [navigateAway, playExit]);

  useSplashExitGate({
    isInitializationComplete,
    minVisibleMs: reducedMotion
      ? SPLASH_REDUCED_MOTION.minVisibleMs
      : SPLASH_TIMINGS.minVisibleMs + SPLASH_TIMINGS.holdAtComplete,
    onReadyToExit: handleReadyToExit,
  });

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (!cancelled && enabled) {
        AccessibilityInfo.announceForAccessibility('VidoraX is loading');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: sequence.contentOpacity.value,
    transform: [
      { translateY: sequence.contentTranslateY.value },
      { scale: sequence.contentScale.value },
    ],
  }));

  return (
    <View
      testID="splash-screen"
      style={splashStyles.root}
      accessibilityLabel={t('splash.loadingScreenA11y')}
      pointerEvents="box-only">
      <StatusBar barStyle="light-content" backgroundColor={SPLASH_COLORS.background} />
      <SplashBackground />

      <Animated.View
        style={[
          splashStyles.safeArea,
          contentStyle,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}>
        <View style={splashStyles.stage}>
          <View style={splashStyles.cluster}>
            <SplashLogo opacity={sequence.logoOpacity} scale={sequence.logoScale} />
            <SplashBrand
              letterOpacities={sequence.letterOpacities}
              letterTranslateYs={sequence.letterTranslateYs}
            />
            <SplashTagline
              wordOpacities={sequence.taglineWordOpacities}
              wordTranslateYs={sequence.taglineWordTranslateYs}
              wordScales={sequence.taglineWordScales}
            />
            <SplashLoader
              opacity={sequence.loaderOpacity}
              progress={sequence.loaderProgress}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

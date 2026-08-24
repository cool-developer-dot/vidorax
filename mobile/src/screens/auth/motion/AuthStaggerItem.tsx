import { memo, useEffect, type ReactNode } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AUTH_FLIP } from '../constants/auth-flip.constants';
import { useAuthFaceReveal } from './auth-flip-motion-context';

export type AuthStaggerItemProps = {
  /** Index into AUTH_FLIP.reveal timing table. */
  step:
    | 'title'
    | 'subtitle'
    | 'firstField'
    | 'remaining'
    | 'button'
    | 'footer';
  children: ReactNode;
};

const STEP_DELAY: Record<AuthStaggerItemProps['step'], number> = {
  title: AUTH_FLIP.reveal.titleMs,
  subtitle: AUTH_FLIP.reveal.subtitleMs,
  firstField: AUTH_FLIP.reveal.firstFieldMs,
  remaining: AUTH_FLIP.reveal.remainingMs,
  button: AUTH_FLIP.reveal.buttonMs,
  footer: AUTH_FLIP.reveal.footerMs,
};

/**
 * Subtle post-flip settle reveal — fade + 7px rise, no bounce.
 * Outside an AuthFaceRevealProvider, content renders fully visible.
 */
export const AuthStaggerItem = memo(function AuthStaggerItem({
  step,
  children,
}: AuthStaggerItemProps) {
  const reveal = useAuthFaceReveal();
  const hasRevealScope = reveal !== null;
  const opacity = useSharedValue(hasRevealScope ? 0 : 1);
  const translateY = useSharedValue(
    hasRevealScope ? AUTH_FLIP.reveal.translateY : 0,
  );

  useEffect(() => {
    if (!reveal) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }

    if (!reveal.active) {
      return;
    }

    if (reveal.reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }

    opacity.value = 0;
    translateY.value = AUTH_FLIP.reveal.translateY;

    const delay = STEP_DELAY[step];
    const duration = AUTH_FLIP.reveal.durationMs;
    const easing = Easing.out(Easing.cubic);

    opacity.value = withDelay(delay, withTiming(1, { duration, easing }));
    translateY.value = withDelay(delay, withTiming(0, { duration, easing }));
  }, [opacity, reveal, reveal?.active, reveal?.reduceMotion, reveal?.revealKey, step, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
});

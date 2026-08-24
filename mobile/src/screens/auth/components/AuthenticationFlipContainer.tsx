import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  AUTH_FLIP,
  type AuthCredentialFace,
} from '../constants/auth-flip.constants';
import { AuthFlipMotionProvider } from '../motion';

export type AuthenticationFlipContainerProps = {
  face: AuthCredentialFace;
  /** When true, skip 3D rotate and crossfade instead. */
  reduceMotion?: boolean;
  /** Fired when a flip animation fully settles on `face`. */
  onFlipSettled?: (face: AuthCredentialFace) => void;
  front: ReactNode;
  back: ReactNode;
};

const flipEasing = Easing.bezier(
  AUTH_FLIP.easing.x1,
  AUTH_FLIP.easing.y1,
  AUTH_FLIP.easing.x2,
  AUTH_FLIP.easing.y2,
);

const OVERSHOOT = AUTH_FLIP.overshootDegrees / 180;

/**
 * Hardware-accelerated Y-axis card flip between two auth faces.
 * Background is owned by the parent — only this card rotates.
 *
 * Directional memory:
 * • Create Account → progress 0→1 (left → right)
 * • Sign In → progress 1→0 (right → left)
 */
export const AuthenticationFlipContainer = memo(function AuthenticationFlipContainer({
  face,
  reduceMotion = false,
  onFlipSettled,
  front,
  back,
}: AuthenticationFlipContainerProps) {
  const progress = useSharedValue(face === 'sign-up' ? 1 : 0);
  const [frontHeight, setFrontHeight] = useState(0);
  const [backHeight, setBackHeight] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [visibleFace, setVisibleFace] = useState<AuthCredentialFace>(face);

  const frontMotion = useMemo(
    () => ({ progress, role: 'front' as const }),
    [progress],
  );
  const backMotion = useMemo(
    () => ({ progress, role: 'back' as const }),
    [progress],
  );

  const notifySettled = useCallback(
    (next: AuthCredentialFace) => {
      setFlipping(false);
      setVisibleFace(next);
      onFlipSettled?.(next);
    },
    [onFlipSettled],
  );

  useEffect(() => {
    const target = face === 'sign-up' ? 1 : 0;
    if (Math.abs(progress.value - target) < 0.0005) {
      setVisibleFace(face);
      return;
    }

    Keyboard.dismiss();
    setFlipping(true);

    if (reduceMotion) {
      progress.value = withTiming(
        target,
        {
          duration: AUTH_FLIP.reducedMotionDurationMs,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(notifySettled)(face);
          }
        },
      );
      return;
    }

    // Directional overshoot: past the target by ~2.5°, then settle.
    const goingToSignUp = target === 1;
    const peak = goingToSignUp ? target + OVERSHOOT : target - OVERSHOOT;
    const mainMs = AUTH_FLIP.durationMs - AUTH_FLIP.overshootMs;

    progress.value = withSequence(
      withTiming(peak, { duration: mainMs, easing: flipEasing }),
      withTiming(
        target,
        {
          duration: AUTH_FLIP.overshootMs,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(notifySettled)(face);
          }
        },
      ),
    );
  }, [face, notifySettled, progress, reduceMotion]);

  const stageStyle = useAnimatedStyle(() => {
    const height =
      frontHeight > 0 && backHeight > 0
        ? interpolate(progress.value, [0, 1], [frontHeight, backHeight])
        : undefined;

    const cameraScale = reduceMotion
      ? 1
      : interpolate(
          progress.value,
          [0, 0.5, 1],
          [1, AUTH_FLIP.cameraScalePeak, 1],
          Extrapolation.CLAMP,
        );

    return {
      height,
      transform: [{ scale: cameraScale }],
    };
  });

  const frontStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {
        opacity: interpolate(progress.value, [0, 0.45, 1], [1, 0, 0]),
        transform: [{ scale: 1 }],
        zIndex: progress.value < 0.5 ? 2 : 0,
      };
    }

    const rotateY = `${progress.value * 180}deg`;
    const scale = interpolate(
      progress.value,
      [0, 0.5, 1],
      [1, AUTH_FLIP.scaleMid, 1],
      Extrapolation.CLAMP,
    );
    const shadowOpacity = interpolate(
      progress.value,
      [0, 0.5, 1],
      [AUTH_FLIP.shadow.start, AUTH_FLIP.shadow.mid, AUTH_FLIP.shadow.end],
      Extrapolation.CLAMP,
    );
    const shadowRadius = interpolate(
      progress.value,
      [0, 0.5, 1],
      [
        AUTH_FLIP.shadow.radiusStart,
        AUTH_FLIP.shadow.radiusMid,
        AUTH_FLIP.shadow.radiusEnd,
      ],
      Extrapolation.CLAMP,
    );
    const shadowOffsetY = interpolate(
      progress.value,
      [0, 0.5, 1],
      [
        AUTH_FLIP.shadow.offsetYStart,
        AUTH_FLIP.shadow.offsetYMid,
        AUTH_FLIP.shadow.offsetYEnd,
      ],
      Extrapolation.CLAMP,
    );

    return {
      zIndex: progress.value < 0.5 ? 2 : 0,
      transform: [
        { perspective: AUTH_FLIP.perspective },
        { rotateY },
        { scale },
      ],
      backfaceVisibility: 'hidden' as const,
      shadowColor: '#000',
      shadowOpacity: Platform.OS === 'ios' ? shadowOpacity : undefined,
      shadowRadius: Platform.OS === 'ios' ? shadowRadius : undefined,
      shadowOffset:
        Platform.OS === 'ios' ? { width: 0, height: shadowOffsetY } : undefined,
      elevation:
        Platform.OS === 'android'
          ? interpolate(progress.value, [0, 0.5, 1], [5, 10, 5], Extrapolation.CLAMP)
          : 0,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {
        opacity: interpolate(progress.value, [0, 0.55, 1], [0, 0, 1]),
        transform: [{ scale: 1 }],
        zIndex: progress.value >= 0.5 ? 2 : 0,
      };
    }

    const rotateY = `${180 + progress.value * 180}deg`;
    const scale = interpolate(
      progress.value,
      [0, 0.5, 1],
      [1, AUTH_FLIP.scaleMid, 1],
      Extrapolation.CLAMP,
    );
    const shadowOpacity = interpolate(
      progress.value,
      [0, 0.5, 1],
      [AUTH_FLIP.shadow.start, AUTH_FLIP.shadow.mid, AUTH_FLIP.shadow.end],
      Extrapolation.CLAMP,
    );
    const shadowRadius = interpolate(
      progress.value,
      [0, 0.5, 1],
      [
        AUTH_FLIP.shadow.radiusStart,
        AUTH_FLIP.shadow.radiusMid,
        AUTH_FLIP.shadow.radiusEnd,
      ],
      Extrapolation.CLAMP,
    );
    const shadowOffsetY = interpolate(
      progress.value,
      [0, 0.5, 1],
      [
        AUTH_FLIP.shadow.offsetYStart,
        AUTH_FLIP.shadow.offsetYMid,
        AUTH_FLIP.shadow.offsetYEnd,
      ],
      Extrapolation.CLAMP,
    );

    return {
      zIndex: progress.value >= 0.5 ? 2 : 0,
      transform: [
        { perspective: AUTH_FLIP.perspective },
        { rotateY },
        { scale },
      ],
      backfaceVisibility: 'hidden' as const,
      shadowColor: '#000',
      shadowOpacity: Platform.OS === 'ios' ? shadowOpacity : undefined,
      shadowRadius: Platform.OS === 'ios' ? shadowRadius : undefined,
      shadowOffset:
        Platform.OS === 'ios' ? { width: 0, height: shadowOffsetY } : undefined,
      elevation:
        Platform.OS === 'android'
          ? interpolate(progress.value, [0, 0.5, 1], [5, 10, 5], Extrapolation.CLAMP)
          : 0,
    };
  });

  /** Glass specular traveling left → right with Create Account, reverse on Sign In. */
  const frontHighlightStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 0 };
    }
    const travel = interpolate(progress.value, [0, 1], [-80, 120], Extrapolation.CLAMP);
    const opacity = interpolate(
      progress.value,
      [0, 0.35, 0.5, 0.65, 1],
      [0.03, 0.1, AUTH_FLIP.glass.highlightOpacityPeak, 0.1, 0.03],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateX: travel }, { skewX: '-18deg' }],
    };
  });

  const backHighlightStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 0 };
    }
    const travel = interpolate(progress.value, [0, 1], [-80, 120], Extrapolation.CLAMP);
    const opacity = interpolate(
      progress.value,
      [0, 0.35, 0.5, 0.65, 1],
      [0.03, 0.1, AUTH_FLIP.glass.highlightOpacityPeak, 0.1, 0.03],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateX: travel }, { skewX: '-18deg' }],
    };
  });

  const frontInteractive =
    !flipping && visibleFace === 'sign-in' && face === 'sign-in';
  const backInteractive =
    !flipping && visibleFace === 'sign-up' && face === 'sign-up';

  return (
    <Animated.View
      style={[styles.stage, stageStyle]}
      accessibilityElementsHidden={flipping}
      importantForAccessibility={flipping ? 'no-hide-descendants' : 'auto'}>
      <Animated.View
        pointerEvents={frontInteractive ? 'auto' : 'none'}
        onLayout={(event) => {
          const next = Math.ceil(event.nativeEvent.layout.height);
          if (next > 0 && next !== frontHeight) {
            setFrontHeight(next);
          }
        }}
        style={[styles.glass, frontStyle]}
        needsOffscreenAlphaCompositing={Platform.OS === 'android'}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS>
        <Animated.View
          pointerEvents="none"
          style={[styles.specular, frontHighlightStyle]}
        />
        <View pointerEvents="none" style={styles.rim} />
        <AuthFlipMotionProvider value={frontMotion}>{front}</AuthFlipMotionProvider>
      </Animated.View>

      <Animated.View
        pointerEvents={backInteractive ? 'auto' : 'none'}
        onLayout={(event) => {
          const next = Math.ceil(event.nativeEvent.layout.height);
          if (next > 0 && next !== backHeight) {
            setBackHeight(next);
          }
        }}
        style={[styles.glass, styles.backFace, backStyle]}
        needsOffscreenAlphaCompositing={Platform.OS === 'android'}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS>
        <Animated.View
          pointerEvents="none"
          style={[styles.specular, backHighlightStyle]}
        />
        <View pointerEvents="none" style={styles.rim} />
        <AuthFlipMotionProvider value={backMotion}>{back}</AuthFlipMotionProvider>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    overflow: 'hidden',
  },
  backFace: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  glass: {
    width: '100%',
    borderRadius: AUTH_FLIP.glass.radius,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: AUTH_FLIP.glass.border,
    backgroundColor: AUTH_FLIP.glass.background,
    paddingHorizontal: AUTH_FLIP.glass.paddingX,
    paddingVertical: AUTH_FLIP.glass.paddingY,
    overflow: 'hidden',
  },
  rim: {
    ...StyleSheet.absoluteFill,
    borderRadius: AUTH_FLIP.glass.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  specular: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: '18%',
    width: '28%',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});

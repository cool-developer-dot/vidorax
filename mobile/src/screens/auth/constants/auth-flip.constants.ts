import { AUTH_COLORS } from './auth.constants';

/** Flagship card-flip motion — cinematic, subtle, 60fps-safe. */
export const AUTH_FLIP = {
  durationMs: 600,
  overshootDegrees: 2.5,
  overshootMs: 72,
  /** Cubic bezier — fast start, soft landing. */
  easing: {
    x1: 0.22,
    y1: 1,
    x2: 0.36,
    y2: 1,
  },
  perspective: 1600,
  /** Card compresses slightly at the edge-on moment. */
  scaleMid: 0.985,
  /** Camera ease-in toward the card (never exceed 1.02). */
  cameraScalePeak: 1.02,
  /** Soft depth shadow — wider/softer/lighter at 90°. */
  shadow: {
    start: 0.2,
    mid: 0.14,
    end: 0.2,
    radiusStart: 16,
    radiusMid: 32,
    radiusEnd: 16,
    offsetYStart: 10,
    offsetYMid: 16,
    offsetYEnd: 10,
  },
  glass: {
    background: 'rgba(12, 15, 24, 0.78)',
    border: 'rgba(255, 255, 255, 0.09)',
    borderAccent: AUTH_COLORS.accentSoft,
    radius: 28,
    paddingX: 20,
    paddingY: 22,
    highlightOpacityPeak: 0.14,
  },
  logo: {
    scaleStart: 0.95,
    scaleEnd: 1,
    glowPeak: 1.35,
    opacityPeak: 1,
  },
  reveal: {
    titleMs: 0,
    subtitleMs: 60,
    firstFieldMs: 120,
    remainingMs: 180,
    buttonMs: 260,
    footerMs: 320,
    durationMs: 320,
    translateY: 7,
  },
  reducedMotionDurationMs: 200,
  ambientBreathMs: 16000,
} as const;

export type AuthCredentialFace = 'sign-in' | 'sign-up';

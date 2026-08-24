/**
 * Double-tap seek region helpers — uses Stage 1 SEEK_STEP_SECONDS.
 */

import { SEEK_STEP_SECONDS } from './types';

export type DoubleTapSeekSide = 'left' | 'right';

export function resolveDoubleTapSide(
  x: number,
  width: number,
): DoubleTapSeekSide | null {
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0) {
    return null;
  }
  return x < width / 2 ? 'left' : 'right';
}

export function doubleTapSeekDelta(side: DoubleTapSeekSide): number {
  return side === 'left' ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS;
}

export const SEEK_FEEDBACK_MS = 700;

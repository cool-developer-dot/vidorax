import {
  PLAYBACK_COMPLETED_PROGRESS_PERCENT,
  PLAYBACK_COMPLETED_REMAINING_SECONDS,
  PLAYBACK_MIN_DURATION_FOR_REMAINING_RULE,
} from './constants.js';
import { computeProgressPercent } from './progress.js';

/**
 * Near-end completion inference (persisted progress).
 * True native playToEnd is signaled separately via markCompleted.
 */
export function isNearEndComplete(input: {
  positionSeconds: number;
  durationSeconds: number;
}): boolean {
  const { positionSeconds, durationSeconds } = input;
  if (
    !Number.isFinite(positionSeconds) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    positionSeconds < 0
  ) {
    return false;
  }

  const progress = computeProgressPercent(positionSeconds, durationSeconds);
  if (progress >= PLAYBACK_COMPLETED_PROGRESS_PERCENT) {
    return true;
  }

  if (durationSeconds >= PLAYBACK_MIN_DURATION_FOR_REMAINING_RULE) {
    const remaining = durationSeconds - positionSeconds;
    if (remaining <= PLAYBACK_COMPLETED_REMAINING_SECONDS) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve durable completed flag.
 * - markCompleted (native playToEnd) always wins upward.
 * - existingCompleted is never downgraded by ordinary progress updates.
 * - replayReset allows intentional Replay/Start Over near the beginning.
 * - near-end inference upgrades incomplete rows near the end.
 */
export function resolveCompletedState(input: {
  positionSeconds: number;
  durationSeconds: number;
  markCompleted?: boolean;
  existingCompleted?: boolean;
  replayReset?: boolean;
}): boolean {
  if (input.replayReset === true) {
    return false;
  }
  if (input.existingCompleted === true) {
    return true;
  }
  if (input.markCompleted === true) {
    return true;
  }
  return isNearEndComplete({
    positionSeconds: input.positionSeconds,
    durationSeconds: input.durationSeconds,
  });
}

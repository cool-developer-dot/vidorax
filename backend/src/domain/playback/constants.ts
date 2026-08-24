/**
 * Playback progress domain constants (Week 8 Day 3 Phase 1).
 * Keep thresholds centralized — never scatter magic numbers.
 */

/** Progress at or above this percentage marks near-end completion. */
export const PLAYBACK_COMPLETED_PROGRESS_PERCENT = 95;

/**
 * Remaining time threshold for near-end completion.
 * Only applied when duration is at least {@link PLAYBACK_MIN_DURATION_FOR_REMAINING_RULE}.
 */
export const PLAYBACK_COMPLETED_REMAINING_SECONDS = 30;

/**
 * Short videos must hit the percentage threshold; remaining-seconds alone
 * must not mark a 20s clip complete almost immediately.
 */
export const PLAYBACK_MIN_DURATION_FOR_REMAINING_RULE = 60;

/** Allow minor player timing overshoot beyond duration. */
export const PLAYBACK_POSITION_DURATION_TOLERANCE_SECONDS = 2;

/** Default page size for history / continue-watching lists. */
export const PLAYBACK_HISTORY_DEFAULT_LIMIT = 20;

/** Cap for GET /playback/recent. */
export const PLAYBACK_RECENT_DEFAULT_LIMIT = 20;

/**
 * Reject / clamp client timestamps farther in the future than this skew window.
 */
export const PLAYBACK_CLIENT_TIMESTAMP_MAX_FUTURE_MS = 5 * 60 * 1000;

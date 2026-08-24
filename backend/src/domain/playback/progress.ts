/**
 * Shared progress normalization — backend is authoritative for percent.
 */

export function clampProgressPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

export function computeProgressPercent(
  positionSeconds: number,
  durationSeconds: number,
): number {
  if (
    !Number.isFinite(positionSeconds) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return 0;
  }
  const safePosition = Math.max(0, positionSeconds);
  return clampProgressPercent((safePosition / durationSeconds) * 100);
}

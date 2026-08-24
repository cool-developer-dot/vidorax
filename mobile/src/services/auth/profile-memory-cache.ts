/**
 * Shared profile cache timestamps for Profile + Edit Profile screens.
 * Cleared on logout so a prior account's stale window cannot suppress refetch.
 */

/** Minimum interval between automatic background profile syncs (ms). */
const PROFILE_STALE_MS = 5 * 60 * 1000;

let lastSuccessfulSyncAt = 0;

export function getProfileCacheTimestamp(): number {
  return lastSuccessfulSyncAt;
}

export function markProfileCacheFresh(at: number = Date.now()): void {
  lastSuccessfulSyncAt = at;
}

export function isProfileCacheStale(now: number = Date.now()): boolean {
  if (lastSuccessfulSyncAt === 0) {
    return true;
  }

  return now - lastSuccessfulSyncAt >= PROFILE_STALE_MS;
}

export function clearProfileCache(): void {
  lastSuccessfulSyncAt = 0;
}

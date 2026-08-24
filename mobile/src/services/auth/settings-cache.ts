/**
 * In-memory settings sync timestamps.
 * Shared by settings.service (logout reset) and the Settings screen hook.
 */

const SETTINGS_STALE_MS = 5 * 60 * 1000;

let lastSuccessfulSyncAt = 0;

export function getSettingsCacheTimestamp(): number {
  return lastSuccessfulSyncAt;
}

export function markSettingsCacheFresh(at: number = Date.now()): void {
  lastSuccessfulSyncAt = at;
}

export function isSettingsCacheStale(now: number = Date.now()): boolean {
  if (lastSuccessfulSyncAt === 0) {
    return true;
  }

  return now - lastSuccessfulSyncAt >= SETTINGS_STALE_MS;
}

export function clearSettingsCache(): void {
  lastSuccessfulSyncAt = 0;
}

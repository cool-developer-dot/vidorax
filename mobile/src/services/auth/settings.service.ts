import { AppState, type AppStateStatus } from 'react-native';

import { isApiError } from '@/api/errors';
import { getSettings, updateSettings as updateSettingsRequest } from '@/api/settings.api';
import type { Settings, ThemeMode, UpdateSettingsRequest } from '@/api/types';
import { isSupportedLanguage, normalizeLanguageCode } from '@/constants/languages';
import { useAuthStore, useSettingsStore, useThemeStore } from '@/store';
import type { ThemePreference } from '@/store/theme';
import { clearSettingsCache } from './settings-cache';

import {
  clearPendingSettingsKeys,
  clearPendingSettingsSync,
  ensurePendingSettingsSyncHydrated,
  getPendingSettingsSync,
  setPendingSettingsSync,
} from './pending-settings-sync';
import {
  apiThemeToPreference,
  sanitizeUpdatePayload,
  themePreferenceToApi,
  validateLanguageOrThrow,
  validateThemePreferenceOrThrow,
} from './settings-validation';

let settingsInFlight: Promise<Settings> | null = null;
/** Single mutex for all preference writes (optimistic PATCH + pending flush). */
let settingsWriteChain: Promise<unknown> = Promise.resolve();
let appStateSubscriptionAttached = false;
/**
 * Bumped on optimistic local writes so an in-flight GET cannot clobber
 * a newer user preference change.
 */
let preferenceWriteEpoch = 0;

export type PreferenceUpdateResult = {
  settings: Settings;
  /** True when the change was kept locally and queued for later sync. */
  pendingSync: boolean;
};

function getActiveUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

function enqueueSettingsWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = settingsWriteChain.then(task, task);
  settingsWriteChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function hydrateSettingsFromApi(settings: Settings): void {
  const store = useSettingsStore.getState();
  const preservedMaxConcurrent = store.maxConcurrentDownloads;

  store.updateSetting('wifiOnly', settings.wifiOnlyDownloads);
  store.updateSetting('autoResume', settings.autoResumeDownloads);
  store.updateSetting('notifications', settings.notificationsEnabled);
  store.updateSetting('downloadDirectory', settings.downloadDirectory);
  if (
    typeof settings.language === 'string' &&
    isSupportedLanguage(normalizeLanguageCode(settings.language))
  ) {
    store.updateSetting('language', normalizeLanguageCode(settings.language));
  }

  if (store.maxConcurrentDownloads !== preservedMaxConcurrent) {
    store.updateSetting('maxConcurrentDownloads', preservedMaxConcurrent);
  }

  if (settings.theme === 'LIGHT' || settings.theme === 'DARK' || settings.theme === 'SYSTEM') {
    useThemeStore.getState().setTheme(apiThemeToPreference(settings.theme));
  }

  // Keep AdmissionScheduler / notification preference in sync (maxConcurrent is local-only).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { publishDownloadSettingsFromStore } = require('@/downloads/settings') as {
      publishDownloadSettingsFromStore: () => void;
    };
    publishDownloadSettingsFromStore();
  } catch {
    // Engine settings module unavailable during early bootstrap.
  }
}

function snapshotAuthSettings(): Settings | null {
  return useAuthStore.getState().settings;
}

function applyOptimisticAuthSettings(patch: UpdateSettingsRequest): void {
  const current = snapshotAuthSettings();
  if (!current) {
    return;
  }

  useAuthStore.getState().setSettings({
    ...current,
    ...patch,
  });
}

function applyOptimisticLocal(patch: UpdateSettingsRequest): void {
  const store = useSettingsStore.getState();
  let touchesDownloadPolicy = false;

  if (patch.wifiOnlyDownloads !== undefined) {
    store.updateSetting('wifiOnly', patch.wifiOnlyDownloads);
    touchesDownloadPolicy = true;
  }
  if (patch.autoResumeDownloads !== undefined) {
    store.updateSetting('autoResume', patch.autoResumeDownloads);
    touchesDownloadPolicy = true;
  }
  if (patch.notificationsEnabled !== undefined) {
    store.updateSetting('notifications', patch.notificationsEnabled);
    touchesDownloadPolicy = true;
  }
  if (patch.downloadDirectory !== undefined) {
    store.updateSetting('downloadDirectory', patch.downloadDirectory);
  }
  if (patch.language !== undefined) {
    store.updateSetting('language', patch.language);
  }
  if (patch.theme !== undefined) {
    useThemeStore.getState().setTheme(apiThemeToPreference(patch.theme));
  }

  if (touchesDownloadPolicy) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { publishDownloadSettingsFromStore } = require('@/downloads/settings') as {
        publishDownloadSettingsFromStore: () => void;
      };
      publishDownloadSettingsFromStore();
    } catch {
      // ignore
    }
  }
}

function restoreSnapshot(
  previousAuth: Settings | null,
  previousLocal: {
    wifiOnly: boolean;
    autoResume: boolean;
    notifications: boolean;
    downloadDirectory: string | null;
    language: string;
    themeMode: ThemePreference;
  },
): void {
  const store = useSettingsStore.getState();
  store.updateSetting('wifiOnly', previousLocal.wifiOnly);
  store.updateSetting('autoResume', previousLocal.autoResume);
  store.updateSetting('notifications', previousLocal.notifications);
  store.updateSetting('downloadDirectory', previousLocal.downloadDirectory);
  store.updateSetting('language', previousLocal.language);
  useThemeStore.getState().setTheme(previousLocal.themeMode);

  if (previousAuth) {
    useAuthStore.getState().setSettings(previousAuth);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { publishDownloadSettingsFromStore } = require('@/downloads/settings') as {
      publishDownloadSettingsFromStore: () => void;
    };
    publishDownloadSettingsFromStore();
  } catch {
    // ignore
  }
}

/**
 * Clears offline preference queue + in-memory settings cache on logout.
 * Also resets local preference/theme stores so the next account does not inherit them.
 */
export function resetSettingsSession(): void {
  clearPendingSettingsSync();
  clearSettingsCache();
  settingsInFlight = null;
}

async function flushPendingSettingsSyncUnlocked(): Promise<Settings | null> {
  const userId = getActiveUserId();
  if (!userId) {
    return null;
  }

  const pending = getPendingSettingsSync(userId);
  if (!pending) {
    return null;
  }

  try {
    const settings = await updateSettingsRequest(
      sanitizeUpdatePayload(pending.payload),
    );
    hydrateSettingsFromApi(settings);
    useAuthStore.getState().setSettings(settings);
    clearPendingSettingsKeys(userId, pending.payload);
    return settings;
  } catch (error) {
    if (isApiError(error) && error.isNetworkError) {
      return null;
    }
    // Non-network failure — drop corrupt/invalid pending payload to avoid loops.
    clearPendingSettingsSync();
    throw error;
  }
}

/**
 * Loads remote settings once (deduped). Failures are non-fatal for callers
 * that catch — local persisted settings remain available.
 * Serialized with preference writes so a stale GET cannot clobber optimistic UI.
 */
export async function loadSettings(): Promise<Settings> {
  if (settingsInFlight) {
    return settingsInFlight;
  }

  settingsInFlight = enqueueSettingsWrite(async () => {
    const epochAtStart = preferenceWriteEpoch;
    const userId = getActiveUserId();
    await flushPendingSettingsSyncUnlocked().catch(() => undefined);

    // If offline queue still has work for this user, keep optimistic local prefs.
    if (userId && getPendingSettingsSync(userId)) {
      const current = useAuthStore.getState().settings;
      if (current) {
        return current;
      }
    }

    const settings = await getSettings();
    if (epochAtStart !== preferenceWriteEpoch) {
      const current = snapshotAuthSettings();
      if (current) {
        return current;
      }
    }

    const pending = userId ? getPendingSettingsSync(userId) : null;
    const merged: Settings = pending
      ? { ...settings, ...sanitizeUpdatePayload(pending.payload) }
      : settings;

    hydrateSettingsFromApi(merged);
    useAuthStore.getState().setSettings(merged);
    return merged;
  }).finally(() => {
    settingsInFlight = null;
  });

  return settingsInFlight;
}

/**
 * Direct PATCH used by authStore.updateSettings.
 * Merges any pending offline keys so partial updates do not wipe the queue.
 */
export async function updateSettings(payload: UpdateSettingsRequest): Promise<Settings> {
  return enqueueSettingsWrite(async () => {
    const userId = getActiveUserId();
    const sanitized = sanitizeUpdatePayload(payload);
    const pending = userId ? getPendingSettingsSync(userId) : null;
    const merged = sanitizeUpdatePayload({
      ...(pending?.payload ?? {}),
      ...sanitized,
    });

    const settings = await updateSettingsRequest(merged);
    hydrateSettingsFromApi(settings);
    useAuthStore.getState().setSettings(settings);

    if (userId) {
      clearPendingSettingsKeys(userId, merged);
    } else {
      clearPendingSettingsSync();
    }

    return settings;
  });
}

/**
 * Optimistic preference update:
 * UI + Zustand + MMKV immediately → PATCH → confirm / rollback / pending sync.
 */
export async function updatePreferenceOptimistic(
  payload: UpdateSettingsRequest,
): Promise<PreferenceUpdateResult> {
  const sanitized = sanitizeUpdatePayload(payload);

  if (Object.keys(sanitized).length === 0) {
    const current = snapshotAuthSettings();
    if (!current) {
      throw new Error('Settings are not loaded');
    }
    return { settings: current, pendingSync: false };
  }

  preferenceWriteEpoch += 1;

  const previousAuth = snapshotAuthSettings();
  const settingsState = useSettingsStore.getState();
  const previousLocal = {
    wifiOnly: settingsState.wifiOnly,
    autoResume: settingsState.autoResume,
    notifications: settingsState.notifications,
    downloadDirectory: settingsState.downloadDirectory,
    language: settingsState.language,
    themeMode: useThemeStore.getState().themeMode,
  };

  applyOptimisticLocal(sanitized);
  applyOptimisticAuthSettings(sanitized);

  const settings = await enqueueSettingsWrite(async () => {
    const userId = getActiveUserId();
    const pending = userId ? getPendingSettingsSync(userId) : null;
    const merged = sanitizeUpdatePayload({
      ...(pending?.payload ?? {}),
      ...sanitized,
    });

    try {
      const next = await updateSettingsRequest(merged);
      hydrateSettingsFromApi(next);
      useAuthStore.getState().setSettings(next);

      if (userId) {
        clearPendingSettingsKeys(userId, merged);
      } else {
        clearPendingSettingsSync();
      }

      return next;
    } catch (error) {
      if (isApiError(error) && error.isNetworkError) {
        if (userId) {
          setPendingSettingsSync(userId, sanitized);
        }

        const current = snapshotAuthSettings() ?? {
          theme: (sanitized.theme ?? previousAuth?.theme ?? 'SYSTEM') as ThemeMode,
          language: sanitized.language ?? previousLocal.language,
          notificationsEnabled:
            sanitized.notificationsEnabled ?? previousLocal.notifications,
          wifiOnlyDownloads: sanitized.wifiOnlyDownloads ?? previousLocal.wifiOnly,
          autoResumeDownloads: sanitized.autoResumeDownloads ?? previousLocal.autoResume,
          downloadDirectory:
            sanitized.downloadDirectory ??
            previousLocal.downloadDirectory ??
            'downloads',
        };
        useAuthStore.getState().setSettings(current);
        return current;
      }

      restoreSnapshot(previousAuth, previousLocal);
      throw error;
    }
  });

  const userId = getActiveUserId();

  return {
    settings,
    pendingSync: userId ? getPendingSettingsSync(userId) !== null : false,
  };
}

export async function updateThemePreference(
  mode: ThemePreference,
): Promise<PreferenceUpdateResult> {
  const validated = validateThemePreferenceOrThrow(mode);
  return updatePreferenceOptimistic({ theme: themePreferenceToApi(validated) });
}

export async function updateLanguagePreference(
  language: string,
): Promise<PreferenceUpdateResult> {
  const validated = validateLanguageOrThrow(language);
  return updatePreferenceOptimistic({ language: validated });
}

export async function updateWifiOnlyPreference(
  value: boolean,
): Promise<PreferenceUpdateResult> {
  return updatePreferenceOptimistic({ wifiOnlyDownloads: value });
}

export async function updateAutoResumePreference(
  value: boolean,
): Promise<PreferenceUpdateResult> {
  return updatePreferenceOptimistic({ autoResumeDownloads: value });
}

export async function updateNotificationsPreference(
  value: boolean,
): Promise<PreferenceUpdateResult> {
  return updatePreferenceOptimistic({ notificationsEnabled: value });
}

/**
 * Attempts to push any queued offline preference patches for the active user.
 * Serialized with preference writes to avoid races.
 */
export async function flushPendingSettingsSync(): Promise<Settings | null> {
  return enqueueSettingsWrite(() => flushPendingSettingsSyncUnlocked());
}

/**
 * Retries pending preference sync when the app returns to the foreground.
 * NetInfo is not in the project — AppState is the supported reconnect signal.
 */
export function ensurePendingSettingsSyncListener(): void {
  ensurePendingSettingsSyncHydrated();

  if (appStateSubscriptionAttached) {
    return;
  }

  appStateSubscriptionAttached = true;

  const onChange = (status: AppStateStatus) => {
    if (status !== 'active') {
      return;
    }
    const userId = getActiveUserId();
    if (!userId || !getPendingSettingsSync(userId)) {
      return;
    }
    void flushPendingSettingsSync().catch(() => undefined);
  };

  AppState.addEventListener('change', onChange);
}

export const settingsService = {
  loadSettings,
  updateSettings,
  updatePreferenceOptimistic,
  updateThemePreference,
  updateLanguagePreference,
  updateWifiOnlyPreference,
  updateAutoResumePreference,
  updateNotificationsPreference,
  flushPendingSettingsSync,
  ensurePendingSettingsSyncListener,
  resetSettingsSession,
  hydrateSettingsFromApi,
} as const;

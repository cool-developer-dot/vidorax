import type { RoutePath } from '@/navigation/constants/route-paths';
import { resolveInitialRoute } from '@/navigation/helpers/resolve-initial-route';
import {
  setLanguage,
  setPreferences,
  setThemeMode,
} from '@/storage/mmkv';
import { initializeSqlite } from '@/storage/sqlite';
import { useAppStore, useAuthStore, useSettingsStore, useThemeStore } from '@/store';
import { setAccessTokenProvider } from '@/api/token';
import { applyNativeColorScheme } from '@/theme/apply-native-color-scheme';
import { bindLanguageReader } from '@/localization/translate';

import { restoreAuthSession } from './restore-auth-session';
import { rehydrateAndWait, waitForStoresHydration } from './wait-for-hydration';

function syncMmkvFromStores(): void {
  const themeMode = useThemeStore.getState().themeMode;
  const settings = useSettingsStore.getState();

  bindLanguageReader(() => useSettingsStore.getState().language);
  setThemeMode(themeMode);
  applyNativeColorScheme(themeMode);
  setLanguage(settings.language);
  setPreferences({
    wifiOnly: settings.wifiOnly,
    autoResume: settings.autoResume,
    notifications: settings.notifications,
    downloadDirectory: settings.downloadDirectory,
    maxConcurrentDownloads: settings.maxConcurrentDownloads,
  });
}

function wireAccessTokenProvider(): void {
  setAccessTokenProvider(() => useAuthStore.getState().accessToken);
}

export async function runAppInitializer(): Promise<RoutePath> {
  const appStore = useAppStore.getState();

  appStore.setLoading(true);

  try {
    const [, sqliteResult] = await Promise.all([
      waitForStoresHydration([
        useAuthStore,
        useAppStore,
        useThemeStore,
        useSettingsStore,
      ]),
      initializeSqlite(),
    ]);

    // Reload settings from the live adapter (MMKV/AsyncStorage), not a
    // captured in-memory map from module-init order.
    await rehydrateAndWait(useSettingsStore);

    wireAccessTokenProvider();

    // MMKV is authoritative for download settings (sync writes). Hydrate into
    // the store BEFORE syncMmkvFromStores so defaults cannot clobber disk.
    try {
      const { hydrateDownloadSettings } = await import(
        '@/downloads/settings'
      );
      hydrateDownloadSettings();
    } catch (error) {
      if (__DEV__) {
        console.warn('[bootstrap] download settings hydrate failed', error);
      }
    }

    syncMmkvFromStores();

    const { ensurePendingSettingsSyncListener } = await import(
      '@/services/auth/settings.service'
    );
    ensurePendingSettingsSyncListener();

    if (!sqliteResult.ready && __DEV__) {
      console.warn(
        '[bootstrap] Local SQLite unavailable:',
        sqliteResult.error?.message ?? 'unknown error',
      );
    }

    await restoreAuthSession();

    try {
      const { bindDownloadEngineToStore } = await import(
        '@/downloads/bind-engine-to-store'
      );
      const { downloadEngine } = await import('@/downloads/engine');
      const { ensureDownloadRecoveryListener } = await import(
        '@/downloads/ensure-recovery-listener'
      );
      const { downloadAppLifecycle } = await import('@/downloads/execution');
      const { ensureDownloadNotificationBridge } = await import(
        '@/downloads/notifications'
      );
      // Direct paths — avoid heavy @/library / @/realtime barrels during bootstrap
      // (circular evaluation can leave named exports undefined → "undefined is not a function").
      const { ensureLibraryCompletionBridge } = await import(
        '@/library/ensure-completion-bridge'
      );
      const { bindDownloadRealtime } = await import(
        '@/realtime/bind-realtime'
      );
      // Bootstrap order: lifecycle → bind → notifications → library → recover → realtime.
      downloadAppLifecycle.ensureAttached();
      bindDownloadEngineToStore();
      ensureDownloadRecoveryListener();
      ensureDownloadNotificationBridge();
      if (typeof ensureLibraryCompletionBridge === 'function') {
        ensureLibraryCompletionBridge();
      }
      void downloadEngine.recover();
      // Realtime is transport-only; durable API remains authoritative.
      if (
        useAuthStore.getState().accessToken &&
        typeof bindDownloadRealtime === 'function'
      ) {
        bindDownloadRealtime();
      }

      // Playback persistence: subscribe once to Day 2 player events (lazy local state).
      try {
        const { bindPlaybackPersistence } = await import(
          '@/playback/bind-playback-persistence'
        );
        if (typeof bindPlaybackPersistence === 'function') {
          bindPlaybackPersistence();
        }
      } catch (playbackError) {
        if (__DEV__) {
          console.warn(
            '[bootstrap] playback persistence bind failed',
            playbackError,
          );
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[bootstrap] download engine init failed', error);
      }
    }

    appStore.initialize();

    // Always enter via branded splash — destination resolved after the sequence.
    return resolveInitialRoute();
  } finally {
    // Always clear bootstrap loading so the branded splash can exit.
    appStore.setLoading(false);
  }
}

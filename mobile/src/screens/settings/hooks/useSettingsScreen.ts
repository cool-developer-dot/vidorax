import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Settings } from '@/api/types';
import { timeouts } from '@/constants';
import { logout } from '@/navigation';
import type { TranslationKey } from '@/localization';
import { selectLanguage, useSettingsStore } from '@/store/settings';
import {
  updateAutoResumePreference,
  updateLanguagePreference,
  updateNotificationsPreference,
  updateThemePreference,
  updateWifiOnlyPreference,
} from '@/services/auth/settings.service';
import {
  selectAuthPhase,
  selectAuthSettings,
  selectAuthUser,
  useAuthStore,
} from '@/store/auth';
import type { ThemePreference } from '@/store/theme';

import { SETTINGS_REFRESH_DEBOUNCE_MS } from '../constants/settings.constants';
import {
  clearSettingsCache,
  getSettingsCacheTimestamp,
  isSettingsCacheStale,
  mapSettingsError,
  markSettingsCacheFresh,
  toSettingsDisplayValues,
  type SettingsDisplayValues,
  type SettingsErrorViewModel,
} from '../utils';

export type SettingsScreenStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error';

export type SettingsFeedbackTone = 'success' | 'pending' | 'error';

export type SettingsFeedback = {
  tone: SettingsFeedbackTone;
  titleKey: TranslationKey;
  messageKey: TranslationKey;
};

export type UseSettingsScreenResult = {
  settings: Settings | null;
  display: SettingsDisplayValues | null;
  status: SettingsScreenStatus;
  loading: boolean;
  refreshing: boolean;
  initialized: boolean;
  saving: boolean;
  error: SettingsErrorViewModel | null;
  feedback: SettingsFeedback | null;
  languageSheetVisible: boolean;
  openLanguageSheet: () => void;
  closeLanguageSheet: () => void;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
  signOut: () => void;
  setTheme: (mode: ThemePreference) => Promise<void>;
  setLanguage: (language: string) => Promise<void>;
  setWifiOnly: (value: boolean) => Promise<void>;
  setAutoResume: (value: boolean) => Promise<void>;
  setNotifications: (value: boolean) => Promise<void>;
};

/**
 * Settings screen data + preference mutation controller.
 *
 * Source of truth: `authStore.settings` (hydrated on login / register / session restore).
 * Local prefs: `settingsStore` + `themeStore` + MMKV via settings.service.
 * Mutations: optimistic → MMKV → PATCH → confirm / rollback / pending offline queue.
 */
export function useSettingsScreen(): UseSettingsScreenResult {
  const settings = useAuthStore(selectAuthSettings);
  const phase = useAuthStore(selectAuthPhase);
  const userId = useAuthStore((state) => selectAuthUser(state)?.id ?? null);
  const loadSettings = useAuthStore((state) => state.loadSettings);

  const [refreshing, setRefreshing] = useState(false);
  const [pendingInitial, setPendingInitial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SettingsErrorViewModel | null>(null);
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);

  const inFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const mountedRef = useRef(true);
  const cacheSeededRef = useRef(false);
  const initialFetchStartedRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationSerialRef = useRef<Promise<void>>(Promise.resolve());
  const trackedUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  // Account switch while Settings tab stays mounted — reset fetch/cache gates.
  useEffect(() => {
    if (trackedUserIdRef.current === userId) {
      return;
    }

    trackedUserIdRef.current = userId;
    cacheSeededRef.current = false;
    initialFetchStartedRef.current = false;
    inFlightRef.current = null;
    setError(null);
    setFeedback(null);
    setLanguageSheetVisible(false);

    if (!userId) {
      clearSettingsCache();
    }
  }, [userId]);

  const showFeedback = useCallback((next: SettingsFeedback) => {
    if (!mountedRef.current) {
      return;
    }
    setFeedback(next);
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setFeedback(null);
      }
    }, timeouts.toast);
  }, []);

  const fetchSettings = useCallback(
    async (mode: 'initial' | 'silent' | 'refresh') => {
      if (inFlightRef.current) {
        return inFlightRef.current;
      }

      const run = (async () => {
        if (mode === 'refresh') {
          setRefreshing(true);
        } else if (mode === 'initial') {
          setPendingInitial(true);
        }

        try {
          // loadSettings flushes pending sync for the active user (deduped).
          await loadSettings();
          markSettingsCacheFresh();
          if (mountedRef.current) {
            setError(null);
          }
        } catch (caught) {
          const mapped = mapSettingsError(caught, 'load');

          if (mapped.kind === 'unauthorized') {
            logout();
            return;
          }

          if (
            mountedRef.current &&
            (mode === 'initial' || !useAuthStore.getState().settings)
          ) {
            setError(mapped);
          }
        } finally {
          if (mountedRef.current) {
            setRefreshing(false);
            setPendingInitial(false);
          }
          inFlightRef.current = null;
        }
      })();

      inFlightRef.current = run;
      return run;
    },
    [loadSettings],
  );

  useEffect(() => {
    const hasCache = settings !== null;
    const isHydrating =
      phase === 'loading_settings' ||
      phase === 'loading_profile' ||
      phase === 'restoring';

    if (isHydrating) {
      return;
    }

    if (hasCache) {
      if (!cacheSeededRef.current) {
        cacheSeededRef.current = true;
        if (getSettingsCacheTimestamp() === 0) {
          markSettingsCacheFresh();
          return;
        }
      }

      if (isSettingsCacheStale() && phase === 'ready') {
        void fetchSettings('silent');
      }
      return;
    }

    if (phase === 'ready' && !initialFetchStartedRef.current) {
      initialFetchStartedRef.current = true;
      void fetchSettings('initial');
    }
  }, [fetchSettings, phase, settings]);

  const runPreferenceMutation = useCallback(
    async (mutate: () => Promise<{ pendingSync: boolean }>) => {
      const task = mutationSerialRef.current.then(async () => {
        if (mountedRef.current) {
          setSaving(true);
        }
        try {
          const result = await mutate();
          if (result.pendingSync) {
            showFeedback({
              tone: 'pending',
              titleKey: 'settings.pendingSyncTitle',
              messageKey: 'settings.pendingSyncMessage',
            });
          } else {
            showFeedback({
              tone: 'success',
              titleKey: 'settings.successTitle',
              messageKey: 'settings.successMessage',
            });
          }
          markSettingsCacheFresh();
        } catch (caught) {
          const mapped = mapSettingsError(caught, 'save');
          if (mapped.kind === 'unauthorized') {
            logout();
            return;
          }
          showFeedback({
            tone: 'error',
            titleKey: 'settings.preferenceErrorTitle',
            messageKey: mapped.messageKey,
          });
        } finally {
          if (mountedRef.current) {
            setSaving(false);
          }
        }
      });

      mutationSerialRef.current = task.catch(() => undefined);
      await task;
    },
    [showFeedback],
  );

  const setTheme = useCallback(
    async (mode: ThemePreference) => {
      const current = useAuthStore.getState().settings?.theme;
      const nextApi =
        mode === 'light' ? 'LIGHT' : mode === 'dark' ? 'DARK' : 'SYSTEM';
      if (current === nextApi) {
        return;
      }
      await runPreferenceMutation(() => updateThemePreference(mode));
    },
    [runPreferenceMutation],
  );

  const setLanguage = useCallback(
    async (language: string) => {
      const currentLocal = useSettingsStore.getState().language;
      if (currentLocal.toLowerCase() === language.toLowerCase()) {
        setLanguageSheetVisible(false);
        return;
      }
      setLanguageSheetVisible(false);
      await runPreferenceMutation(() => updateLanguagePreference(language));
    },
    [runPreferenceMutation],
  );

  const setWifiOnly = useCallback(
    async (value: boolean) => {
      if (useAuthStore.getState().settings?.wifiOnlyDownloads === value) {
        return;
      }
      await runPreferenceMutation(() => updateWifiOnlyPreference(value));
    },
    [runPreferenceMutation],
  );

  const setAutoResume = useCallback(
    async (value: boolean) => {
      if (useAuthStore.getState().settings?.autoResumeDownloads === value) {
        return;
      }
      await runPreferenceMutation(() => updateAutoResumePreference(value));
    },
    [runPreferenceMutation],
  );

  const setNotifications = useCallback(
    async (value: boolean) => {
      if (useAuthStore.getState().settings?.notificationsEnabled === value) {
        return;
      }
      await runPreferenceMutation(() => updateNotificationsPreference(value));
    },
    [runPreferenceMutation],
  );

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < SETTINGS_REFRESH_DEBOUNCE_MS) {
      return;
    }
    lastRefreshAtRef.current = now;
    await fetchSettings('refresh');
  }, [fetchSettings]);

  const retry = useCallback(async () => {
    if (!settings) {
      initialFetchStartedRef.current = true;
    }
    await fetchSettings(settings ? 'refresh' : 'initial');
  }, [fetchSettings, settings]);

  const signOut = useCallback(() => {
    logout();
  }, []);

  const openLanguageSheet = useCallback(() => {
    setLanguageSheetVisible(true);
  }, []);

  const closeLanguageSheet = useCallback(() => {
    setLanguageSheetVisible(false);
  }, []);

  const isHydrating =
    phase === 'loading_settings' ||
    phase === 'loading_profile' ||
    phase === 'restoring';

  const loading = !settings && (isHydrating || pendingInitial || phase !== 'ready');

  const status: SettingsScreenStatus = (() => {
    if (settings) {
      return 'ready';
    }
    if (isHydrating || pendingInitial) {
      return 'loading';
    }
    if (error) {
      return 'error';
    }
    if (phase !== 'ready') {
      return 'loading';
    }
    return 'empty';
  })();

  const language = useSettingsStore(selectLanguage);
  const display = useMemo(
    () => (settings ? toSettingsDisplayValues(settings) : null),
    [language, settings],
  );

  return {
    settings,
    display,
    status,
    loading,
    refreshing,
    initialized: settings !== null || phase === 'ready',
    saving,
    error,
    feedback,
    languageSheetVisible,
    openLanguageSheet,
    closeLanguageSheet,
    refresh,
    retry,
    signOut,
    setTheme,
    setLanguage,
    setWifiOnly,
    setAutoResume,
    setNotifications,
  };
}

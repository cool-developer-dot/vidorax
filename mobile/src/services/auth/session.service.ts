import {
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '@/api/auth.api';
import { isApiError } from '@/api/errors';
import type {
  LoginRequest,
  Profile,
  RegisterRequest,
  Settings,
  Tokens,
  User,
} from '@/api/types';
import { queryClient } from '@/services/query-client';
import { useAuthStore, type SessionPhase } from '@/store/auth';
import { useSettingsStore, useThemeStore } from '@/store';

import {
  clearUserSession,
  hydrateUserFromAuthUser,
  hydrateUserFromProfile,
  loadProfile,
  updateProfile as updateProfileService,
} from './profile.service';
import {
  clearProfileSnapshot,
  loadProfileSnapshot,
  saveProfileSnapshot,
} from './profile-snapshot.service';
import {
  loadSettings,
  updateSettings as updateSettingsService,
} from './settings.service';
import { deleteTokens, loadTokens, saveTokens } from './secure-token.service';
import { refreshSession } from './token-refresh.service';

export type { SessionPhase };

async function applyTokens(tokens: Tokens, rememberMe: boolean): Promise<void> {
  useAuthStore.getState().setRememberMe(rememberMe);
  useAuthStore.getState().setTokens(tokens);

  if (rememberMe) {
    try {
      await saveTokens(tokens);
    } catch {
      // Memory tokens remain; SecureStore failure is non-fatal for the session.
    }
  } else {
    await deleteTokens();
  }
}

async function commitAuthenticatedProfile(profile: Profile): Promise<void> {
  useAuthStore.getState().setUser(profile);
  await saveProfileSnapshot(profile);
}

async function hydrateProfileAndSettings(fallbackUser?: User): Promise<{
  profile: Profile | null;
  settings: Settings | null;
}> {
  const auth = useAuthStore.getState();

  auth.setPhase('loading_profile');
  let profile: Profile | null = null;

  try {
    profile = await loadProfile();
    await commitAuthenticatedProfile(profile);
  } catch (error) {
    if (fallbackUser) {
      hydrateUserFromAuthUser(fallbackUser);
      const fallbackProfile: Profile = {
        id: fallbackUser.id,
        email: fallbackUser.email,
        name: fallbackUser.name,
        role: fallbackUser.role,
        avatarUrl: null,
        emailVerified: false,
        createdAt: fallbackUser.createdAt,
        updatedAt: fallbackUser.createdAt,
      };
      await commitAuthenticatedProfile(fallbackProfile);
      profile = fallbackProfile;
    } else if (isApiError(error) && error.isUnauthorized) {
      throw error;
    } else if (error instanceof Error && error.name === 'SessionSupersededError') {
      throw error;
    } else {
      throw error;
    }
  }

  auth.setPhase('loading_settings');
  let settings: Settings | null = null;

  try {
    settings = await loadSettings();
    auth.setSettings(settings);
  } catch (settingsError) {
    if (__DEV__) {
      console.warn('[session] settings hydrate failed', settingsError);
    }
  }

  return { profile, settings };
}

/**
 * Clears SecureStore tokens, Zustand auth/user/settings/theme session, and React Query cache.
 * Does not navigate — callers own navigation.
 */
export async function clearSession(): Promise<void> {
  try {
    const { stopDownloadRealtime } = await import('@/realtime/bind-realtime');
    stopDownloadRealtime();
  } catch {
    // realtime optional during teardown
  }

  await deleteTokens();
  await clearProfileSnapshot();
  clearUserSession();
  queryClient.clear();
  useAuthStore.getState().clearSessionState();

  const { resetSettingsSession } = await import('./settings.service');
  resetSettingsSession();

  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();

  const { useFavoritesStore } = await import('@/store/favorites');
  useFavoritesStore.getState().reset();

  const { useLibraryStore } = await import('@/store/library');
  const { clearLibraryAvailabilityCache } = await import('@/library/repository');
  useLibraryStore.getState().reset();
  clearLibraryAvailabilityCache();

  // Prevent previous-account download rows from flashing before the next fetch.
  try {
    const { useDownloadsStore } = await import('@/store/downloads');
    useDownloadsStore.getState().reset();
  } catch {
    // downloads store optional during teardown
  }

  // Folders / assignments are user-scoped; clear persisted cache on logout.
  try {
    const { useFoldersStore } = await import('@/store/organization/folders');
    useFoldersStore.getState().reset();
  } catch {
    // optional during teardown
  }
  try {
    const { useMediaFolderAssignmentsStore } = await import(
      '@/store/organization/folder-assignments'
    );
    useMediaFolderAssignmentsStore.getState().reset();
  } catch {
    // optional during teardown
  }

  try {
    const { resetPlaybackPersistenceForLogout } = await import(
      '@/playback/bind-playback-persistence'
    );
    resetPlaybackPersistenceForLogout();
  } catch {
    // playback persistence optional during teardown
  }
}

export async function login(
  payload: LoginRequest,
  options?: { rememberMe?: boolean },
): Promise<{ user: User }> {
  const rememberMe = options?.rememberMe ?? true;
  const auth = useAuthStore.getState();
  auth.setLoading(true);
  auth.setPhase('loading_profile');

  try {
    const session = await loginRequest(payload);
    await applyTokens(
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      },
      rememberMe,
    );

    await hydrateProfileAndSettings(session.user);

    auth.markSessionRestored(true);
    auth.setPhase('ready');
    try {
      const { bindDownloadRealtime } = await import('@/realtime/bind-realtime');
      bindDownloadRealtime();
    } catch {
      // non-fatal
    }
    return { user: session.user };
  } catch (error) {
    await clearSession();
    auth.setPhase('unauthenticated');
    throw error;
  } finally {
    auth.setLoading(false);
  }
}

export async function register(payload: RegisterRequest): Promise<{ user: User }> {
  const auth = useAuthStore.getState();
  auth.setLoading(true);
  auth.setPhase('loading_profile');

  try {
    const session = await registerRequest(payload);
    await applyTokens(
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      },
      true,
    );

    await hydrateProfileAndSettings(session.user);

    auth.markSessionRestored(true);
    auth.setPhase('ready');
    try {
      const { bindDownloadRealtime } = await import('@/realtime/bind-realtime');
      bindDownloadRealtime();
    } catch {
      // non-fatal
    }
    return { user: session.user };
  } catch (error) {
    await clearSession();
    auth.setPhase('unauthenticated');
    throw error;
  } finally {
    auth.setLoading(false);
  }
}

/**
 * Logout: best-effort API call, then always clear local session.
 */
export async function logout(): Promise<void> {
  const auth = useAuthStore.getState();
  auth.setLoading(true);

  try {
    if (auth.accessToken) {
      try {
        await logoutRequest();
      } catch {
        // Network / auth failures must not block local logout.
      }
    }
  } finally {
    await clearSession();
    auth.setPhase('unauthenticated');
    auth.markSessionRestored(true);
    auth.setLoading(false);
  }
}

/**
 * App-launch session restore.
 * - Missing token → unauthenticated
 * - Valid token → hydrate profile + settings
 * - 401/403 → clear session
 * - Offline / timeout / 5xx → keep tokens only when a cached profile exists
 */
export async function restoreSession(): Promise<boolean> {
  const auth = useAuthStore.getState();
  auth.setLoading(true);
  auth.setPhase('restoring');

  try {
    // Prefer dedicated SecureStore keys; migrate legacy Zustand blob tokens.
    const stored = await loadTokens();
    if (stored) {
      auth.setTokens(stored);
    } else if (auth.rememberMe && auth.accessToken && auth.refreshToken) {
      try {
        await saveTokens({
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
        });
      } catch {
        // Keep in-memory tokens if migration write fails.
      }
    }

    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      auth.markSessionRestored(true);
      auth.setPhase('unauthenticated');
      return false;
    }

    // Seed identity from SecureStore before network so offline restore is fail-closed
    // only when no snapshot exists (never enter the app shell with a null user).
    const snapshot = await loadProfileSnapshot();
    if (snapshot) {
      hydrateUserFromProfile(snapshot);
      auth.setUser(snapshot);
    }

    try {
      await hydrateProfileAndSettings();
      auth.markSessionRestored(true);
      auth.setPhase('ready');
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'SessionSupersededError') {
        auth.markSessionRestored(true);
        auth.setPhase('unauthenticated');
        return false;
      }

      const cachedUser = useAuthStore.getState().user;

      if (isApiError(error) && error.isNetworkError) {
        if (cachedUser) {
          auth.markSessionRestored(true);
          auth.setPhase('ready');
          return true;
        }

        await clearSession();
        auth.markSessionRestored(true);
        auth.setPhase('unauthenticated');
        return false;
      }

      if (isApiError(error) && error.code === 'SERVER_ERROR') {
        if (cachedUser) {
          auth.markSessionRestored(true);
          auth.setPhase('ready');
          return true;
        }

        await clearSession();
        auth.markSessionRestored(true);
        auth.setPhase('unauthenticated');
        return false;
      }

      if (
        isApiError(error) &&
        (error.isUnauthorized || error.isForbidden)
      ) {
        await clearSession();
        auth.markSessionRestored(true);
        auth.setPhase('unauthenticated');
        return false;
      }

      // Unexpected profile failure — fail closed for security.
      await clearSession();
      auth.markSessionRestored(true);
      auth.setPhase('unauthenticated');
      return false;
    }
  } finally {
    useAuthStore.getState().setLoading(false);
  }
}

export async function loadSessionProfile(): Promise<Profile> {
  const profile = await loadProfile();
  await commitAuthenticatedProfile(profile);
  return profile;
}

export async function loadSessionSettings(): Promise<Settings> {
  const settings = await loadSettings();
  useAuthStore.getState().setSettings(settings);
  return settings;
}

export const sessionService = {
  login,
  register,
  logout,
  restoreSession,
  clearSession,
  refreshSession,
  loadProfile: loadSessionProfile,
  loadSettings: loadSessionSettings,
  updateProfile: updateProfileService,
  updateSettings: updateSettingsService,
  hydrateUserFromProfile,
} as const;

import type { StoreApi } from 'zustand';

import type { Tokens } from '@/api/types';

import { initialAuthState } from './state';
import type { AuthActions, AuthStore } from './types';

export function createAuthActions(
  set: StoreApi<AuthStore>['setState'],
  get: StoreApi<AuthStore>['getState'],
): AuthActions {
  return {
    setTokens: ({ accessToken, refreshToken }) => {
      set({ accessToken, refreshToken });
    },
    setRememberMe: (rememberMe) => {
      set({ rememberMe });
    },
    setLoading: (isLoading) => {
      set({ isLoading });
    },
    setRefreshing: (isRefreshing) => {
      set({ isRefreshing });
    },
    setPhase: (phase) => {
      set({ phase });
    },
    setUser: (user) => {
      set({ user });
    },
    setSettings: (settings) => {
      set({ settings });
    },
    markSessionRestored: (sessionRestored = true) => {
      set({ sessionRestored });
    },
    clearTokens: () => {
      set({ accessToken: null, refreshToken: null });
    },
    clearSessionState: () => {
      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        settings: null,
        isRefreshing: false,
        isLoading: false,
        phase: 'unauthenticated',
      });
    },
    persistTokens: async (tokens: Tokens) => {
      const rememberMe = get().rememberMe;
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

      const { saveTokens, deleteTokens } = await import(
        '@/services/auth/secure-token.service'
      );

      if (rememberMe) {
        await saveTokens(tokens);
      } else {
        await deleteTokens();
      }
    },
    reset: () => {
      set(initialAuthState);
    },

    // Session orchestration — dynamic imports avoid circular deps with session.service.
    login: async (payload, options) => {
      const { login } = await import('@/services/auth/session.service');
      return login(payload, options);
    },
    register: async (payload) => {
      const { register } = await import('@/services/auth/session.service');
      return register(payload);
    },
    logout: async () => {
      const { logout } = await import('@/services/auth/session.service');
      return logout();
    },
    restoreSession: async () => {
      const { restoreSession } = await import('@/services/auth/session.service');
      return restoreSession();
    },
    refreshSession: async () => {
      const { refreshSession } = await import(
        '@/services/auth/token-refresh.service'
      );
      return refreshSession();
    },
    clearSession: async () => {
      const { clearSession } = await import('@/services/auth/session.service');
      return clearSession();
    },
    loadProfile: async () => {
      const { loadSessionProfile } = await import(
        '@/services/auth/session.service'
      );
      return loadSessionProfile();
    },
    loadSettings: async () => {
      const { loadSessionSettings } = await import(
        '@/services/auth/session.service'
      );
      return loadSessionSettings();
    },
    updateProfile: async (payload) => {
      const { updateProfile } = await import(
        '@/services/auth/profile.service'
      );
      const { saveProfileSnapshot } = await import(
        '@/services/auth/profile-snapshot.service'
      );
      const profile = await updateProfile(payload);
      set({ user: profile });
      await saveProfileSnapshot(profile);
      return profile;
    },
    uploadAvatar: async (options) => {
      const { uploadAvatar } = await import('@/services/avatar');
      const { saveProfileSnapshot } = await import(
        '@/services/auth/profile-snapshot.service'
      );
      const profile = await uploadAvatar(options);
      set({ user: profile });
      await saveProfileSnapshot(profile);
      return profile;
    },
    removeAvatar: async (signal) => {
      const { removeAvatar } = await import('@/services/avatar');
      const { saveProfileSnapshot } = await import(
        '@/services/auth/profile-snapshot.service'
      );
      const profile = await removeAvatar(signal);
      set({ user: profile });
      await saveProfileSnapshot(profile);
      return profile;
    },
    updateSettings: async (payload) => {
      const { updateSettings } = await import(
        '@/services/auth/settings.service'
      );
      const settings = await updateSettings(payload);
      set({ settings });
      return settings;
    },
  };
}

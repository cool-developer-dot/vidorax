import type { AuthStore } from './types';

export const selectAccessToken = (state: AuthStore) => state.accessToken;
export const selectRefreshToken = (state: AuthStore) => state.refreshToken;
export const selectRememberMe = (state: AuthStore) => state.rememberMe;
export const selectAuthLoading = (state: AuthStore) => state.isLoading;
export const selectAuthRefreshing = (state: AuthStore) => state.isRefreshing;
export const selectSessionRestored = (state: AuthStore) => state.sessionRestored;
export const selectAuthPhase = (state: AuthStore) => state.phase;
export const selectAuthUser = (state: AuthStore) => state.user;
export const selectAuthSettings = (state: AuthStore) => state.settings;

/** Fully authenticated: tokens present and session hydration finished. */
export const selectIsAuthenticated = (state: AuthStore) =>
  state.accessToken !== null && state.phase === 'ready';

export const selectIsSessionReady = (state: AuthStore) =>
  state.sessionRestored && !state.isLoading;

import type { AuthState } from './types';

export const initialAuthState: AuthState = {
  accessToken: null,
  refreshToken: null,
  rememberMe: true,
  isLoading: false,
  isRefreshing: false,
  sessionRestored: false,
  phase: 'idle',
  user: null,
  settings: null,
};

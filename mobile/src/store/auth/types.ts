import type { Profile, Settings, Tokens } from '@/api/types';

export type SessionPhase =
  | 'idle'
  | 'restoring'
  | 'loading_profile'
  | 'loading_settings'
  | 'ready'
  | 'unauthenticated';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  rememberMe: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  sessionRestored: boolean;
  phase: SessionPhase;
  user: Profile | null;
  settings: Settings | null;
}

export interface AuthActions {
  setTokens: (tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  }) => void;
  setRememberMe: (rememberMe: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  setPhase: (phase: SessionPhase) => void;
  setUser: (user: Profile | null) => void;
  setSettings: (settings: Settings | null) => void;
  markSessionRestored: (sessionRestored?: boolean) => void;
  clearTokens: () => void;
  clearSessionState: () => void;
  persistTokens: (tokens: Tokens) => Promise<void>;
  reset: () => void;

  login: (
    payload: { email: string; password: string },
    options?: { rememberMe?: boolean },
  ) => Promise<{ user: import('@/api/types').User }>;
  register: (payload: {
    email: string;
    password: string;
    name: string;
  }) => Promise<{ user: import('@/api/types').User }>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  refreshSession: () => Promise<Tokens>;
  clearSession: () => Promise<void>;
  loadProfile: () => Promise<Profile>;
  loadSettings: () => Promise<Settings>;
  updateProfile: (
    payload: import('@/api/types').UpdateProfileRequest,
  ) => Promise<Profile>;
  uploadAvatar: (
    options: import('@/services/avatar').UploadAvatarOptions,
  ) => Promise<Profile>;
  removeAvatar: (signal?: AbortSignal) => Promise<Profile>;
  updateSettings: (
    payload: import('@/api/types').UpdateSettingsRequest,
  ) => Promise<Settings>;
}

export type AuthStore = AuthState & AuthActions;

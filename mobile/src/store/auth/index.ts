import { persist } from 'zustand/middleware';

import { storageKeys } from '@/constants';
import { createStore } from '@/store/shared/create-store';
import { createSecurePersistStorage } from '@/store/shared/secure-storage';

import { createAuthActions } from './actions';
import { initialAuthState } from './state';
import type { AuthStore } from './types';

type PersistedAuthSlice = {
  rememberMe: boolean;
  /** @deprecated Migrated to dedicated SecureStore token keys. */
  accessToken?: string | null;
  /** @deprecated Migrated to dedicated SecureStore token keys. */
  refreshToken?: string | null;
};

export const useAuthStore = createStore<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialAuthState,
      ...createAuthActions(set, get),
    }),
    {
      name: storageKeys.auth,
      storage: createSecurePersistStorage(),
      // Tokens live in dedicated SecureStore keys (secure-token.service).
      // Only rememberMe preference is persisted in the Zustand blob.
      partialize: (state): PersistedAuthSlice => ({
        rememberMe: state.rememberMe ?? true,
      }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as PersistedAuthSlice;
        return {
          ...current,
          rememberMe: stored.rememberMe ?? true,
          // One-time migration: hydrate legacy tokens from the old blob.
          accessToken: stored.accessToken ?? current.accessToken,
          refreshToken: stored.refreshToken ?? current.refreshToken,
        };
      },
    },
  ),
);

export * from './selectors';
export type { AuthActions, AuthState, AuthStore, SessionPhase } from './types';

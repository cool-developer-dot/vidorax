import { useCallback, useEffect, useRef, useState } from 'react';

import type { Profile } from '@/api/types';
import { logout } from '@/navigation';
import {
  selectAuthPhase,
  selectAuthUser,
  useAuthStore,
} from '@/store/auth';

import {
  PROFILE_REFRESH_DEBOUNCE_MS,
} from '../constants/profile.constants';
import {
  mapProfileError,
  type ProfileErrorViewModel,
} from '../utils/map-profile-error';
import {
  getProfileCacheTimestamp,
  isProfileCacheStale,
  markProfileCacheFresh,
} from '../utils/profile-cache';

export type ProfileScreenStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error';

export type UseProfileScreenResult = {
  user: Profile | null;
  status: ProfileScreenStatus;
  refreshing: boolean;
  error: ProfileErrorViewModel | null;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

/**
 * Profile screen data controller.
 *
 * Source of truth: `authStore.user` (hydrated on login / session restore).
 * Does not introduce a parallel user store or duplicate GET /users/me clients.
 *
 * Cache policy:
 * - Cached profile → render immediately; background sync only when stale.
 * - No profile → initial fetch with skeleton.
 * - Pull-to-refresh → forced fetch (deduped by profile.service).
 */
export function useProfileScreen(): UseProfileScreenResult {
  const user = useAuthStore(selectAuthUser);
  const phase = useAuthStore(selectAuthPhase);
  const loadProfile = useAuthStore((state) => state.loadProfile);

  const [refreshing, setRefreshing] = useState(false);
  const [pendingInitial, setPendingInitial] = useState(false);
  const [error, setError] = useState<ProfileErrorViewModel | null>(null);

  const inFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const mountedRef = useRef(true);
  const cacheSeededRef = useRef(false);
  const initialFetchStartedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchProfile = useCallback(
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
          await loadProfile();
          markProfileCacheFresh();
          if (mountedRef.current) {
            setError(null);
          }
        } catch (caught) {
          const mapped = mapProfileError(caught);

          if (mapped.kind === 'unauthorized') {
            logout();
            return;
          }

          // Keep cached profile visible on refresh/silent failures.
          if (mountedRef.current && (mode === 'initial' || !useAuthStore.getState().user)) {
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
    [loadProfile],
  );

  useEffect(() => {
    const hasCache = user !== null;
    const isHydrating = phase === 'loading_profile' || phase === 'restoring';

    if (isHydrating) {
      return;
    }

    if (hasCache) {
      // Login / session restore already hydrated authStore — treat as fresh once.
      // Do not immediately refetch; background-sync only after the stale window.
      if (!cacheSeededRef.current) {
        cacheSeededRef.current = true;
        if (getProfileCacheTimestamp() === 0) {
          markProfileCacheFresh();
          return;
        }
      }

      if (isProfileCacheStale() && phase === 'ready') {
        void fetchProfile('silent');
      }
      return;
    }

    if (phase === 'ready' && !initialFetchStartedRef.current) {
      initialFetchStartedRef.current = true;
      void fetchProfile('initial');
    }
  }, [fetchProfile, phase, user]);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < PROFILE_REFRESH_DEBOUNCE_MS) {
      return;
    }
    lastRefreshAtRef.current = now;
    await fetchProfile('refresh');
  }, [fetchProfile]);

  const retry = useCallback(async () => {
    if (!user) {
      initialFetchStartedRef.current = true;
    }
    await fetchProfile(user ? 'refresh' : 'initial');
  }, [fetchProfile, user]);

  const isHydrating = phase === 'loading_profile' || phase === 'restoring';

  const status: ProfileScreenStatus = (() => {
    if (user) {
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

  return {
    user,
    status,
    refreshing,
    error,
    refresh,
    retry,
  };
}

import { Redirect } from 'expo-router';
import { type PropsWithChildren, useEffect } from 'react';

import { selectAppInitialized, useAppStore } from '@/store/app';
import {
  selectIsAuthenticated,
  selectSessionRestored,
  useAuthStore,
} from '@/store/auth';

import { routePaths } from '../constants/route-paths';

/**
 * Blocks protected app routes until the session is restored,
 * then redirects guests to Sign In.
 */
export function ProtectedRouteGuard({ children }: PropsWithChildren) {
  const isInitialized = useAppStore(selectAppInitialized);
  const sessionRestored = useAuthStore(selectSessionRestored);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  useEffect(() => {
    if (!isInitialized || !sessionRestored || !isAuthenticated) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { setNotificationNavigationReady } = await import(
          '@/downloads/notifications'
        );
        if (!cancelled) {
          setNotificationNavigationReady(true);
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isInitialized, sessionRestored, isAuthenticated]);

  if (!isInitialized || !sessionRestored) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href={routePaths.signIn} />;
  }

  return children;
}

/** Alias matching the production auth-guard naming. */
export const AuthGuard = ProtectedRouteGuard;

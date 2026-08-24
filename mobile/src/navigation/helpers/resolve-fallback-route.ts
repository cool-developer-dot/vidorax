import {
  selectAppInitialized,
  selectOnboardingComplete,
  useAppStore,
} from '@/store/app';
import { selectIsAuthenticated, useAuthStore } from '@/store/auth';

import { routePaths, type RoutePath } from '../constants/route-paths';

import { resolvePostSplashRoute } from './resolve-post-splash-route';

export function resolveFallbackRoute(): RoutePath {
  const appState = useAppStore.getState();

  if (!selectAppInitialized(appState)) {
    return routePaths.splash;
  }

  return resolvePostSplashRoute({
    onboardingComplete: selectOnboardingComplete(appState),
    isAuthenticated: selectIsAuthenticated(useAuthStore.getState()),
  });
}

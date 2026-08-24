import { selectOnboardingComplete, useAppStore } from '@/store/app';
import { selectIsAuthenticated, useAuthStore } from '@/store/auth';

import { routePaths, type RoutePath } from '../constants/route-paths';

type ResolvePostSplashRouteParams = {
  onboardingComplete?: boolean;
  isAuthenticated?: boolean;
};

/**
 * Destination after the branded splash finishes.
 * Splash itself always plays; this only decides where to go next.
 */
export function resolvePostSplashRoute(
  params?: ResolvePostSplashRouteParams,
): RoutePath {
  const onboardingComplete =
    params?.onboardingComplete ??
    selectOnboardingComplete(useAppStore.getState());
  const isAuthenticated =
    params?.isAuthenticated ??
    selectIsAuthenticated(useAuthStore.getState());

  if (!onboardingComplete) {
    return routePaths.onboarding;
  }

  if (!isAuthenticated) {
    return routePaths.signUp;
  }

  return routePaths.home;
}

import { Redirect, usePathname } from 'expo-router';
import { Fragment, type PropsWithChildren } from 'react';

import {
  selectIsAuthenticated,
  selectSessionRestored,
  useAuthStore,
} from '@/store/auth';

import { isAuthOnlyGuestRoute } from '../constants/route-access';
import { routePaths } from '../constants/route-paths';

/**
 * Prevents authenticated users from revisiting login/register while
 * allowing splash/onboarding during bootstrap.
 */
export function GuestRouteGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const sessionRestored = useAuthStore(selectSessionRestored);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (sessionRestored && isAuthenticated && isAuthOnlyGuestRoute(pathname)) {
    return <Redirect href={routePaths.home} />;
  }

  return <Fragment>{children}</Fragment>;
}

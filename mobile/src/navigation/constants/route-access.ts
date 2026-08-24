import { routePaths } from './route-paths';

/** Routes that require an authenticated session. */
export const protectedRoutes = [
  routePaths.home,
  routePaths.browser,
  routePaths.downloads,
  routePaths.library,
  routePaths.settings,
  routePaths.downloadSettings,
  routePaths.profile,
  routePaths.editProfile,
  routePaths.about,
  routePaths.support,
  routePaths.privacy,
  routePaths.terms,
  routePaths.history,
  routePaths.watchHistory,
  routePaths.bookmarks,
  routePaths.favorites,
] as const;

/** Auth flow routes available to unauthenticated users. */
export const guestRoutes = [
  routePaths.splash,
  routePaths.onboarding,
  routePaths.signIn,
  routePaths.signUp,
  routePaths.forgotPassword,
] as const;

/** Auth entry routes authenticated users should not revisit. */
export const authOnlyGuestRoutes = [
  routePaths.signIn,
  routePaths.signUp,
  routePaths.forgotPassword,
] as const;

/** Routes reachable without authentication (bootstrap + auth entry). */
export const publicRoutes = [...guestRoutes] as const;

export type ProtectedRoute = (typeof protectedRoutes)[number];
export type GuestRoute = (typeof guestRoutes)[number];
export type PublicRoute = (typeof publicRoutes)[number];

export type AuthOnlyGuestRoute = (typeof authOnlyGuestRoutes)[number];

export function isGuestRoute(pathname: string): pathname is GuestRoute {
  return guestRoutes.some((route) => route === pathname);
}

export function isAuthOnlyGuestRoute(
  pathname: string,
): pathname is AuthOnlyGuestRoute {
  return authOnlyGuestRoutes.some((route) => route === pathname);
}

export function isProtectedRoute(pathname: string): pathname is ProtectedRoute {
  if (protectedRoutes.some((route) => route === pathname)) {
    return true;
  }

  // Download details live on the app stack as /downloads/:id
  return /^\/downloads\/[^/]+$/.test(pathname);
}

export function isKnownRoute(pathname: string): boolean {
  return isGuestRoute(pathname) || isProtectedRoute(pathname);
}

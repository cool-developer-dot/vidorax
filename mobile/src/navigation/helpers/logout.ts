import { routePaths } from '../constants/route-paths';

import { safeDismissAll, safeReplace } from './safe-navigation';

/**
 * Clears the authenticated session and navigates to Sign In.
 * Safe to call from UI — never throws.
 */
export async function performLogout(): Promise<void> {
  try {
    const { logout } = await import('@/services/auth/session.service');
    await logout();
  } catch {
    try {
      const { clearSession } = await import('@/services/auth/session.service');
      await clearSession();
    } catch {
      // Local clear is best-effort.
    }
  }

  safeDismissAll();
  safeReplace(routePaths.signIn);
}

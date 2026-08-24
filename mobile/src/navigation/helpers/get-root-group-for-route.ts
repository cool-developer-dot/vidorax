import { routeGroups } from '../constants/route-groups';
import { routePaths, type RoutePath } from '../constants/route-paths';

const authRoutes = new Set<RoutePath>([
  routePaths.splash,
  routePaths.onboarding,
  routePaths.signIn,
  routePaths.signUp,
  routePaths.forgotPassword,
]);

export function getRootGroupForRoute(
  route: RoutePath,
): typeof routeGroups.app | typeof routeGroups.auth {
  return authRoutes.has(route) ? routeGroups.auth : routeGroups.app;
}

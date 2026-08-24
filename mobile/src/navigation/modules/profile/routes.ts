import { routePaths } from '../../constants/route-paths';

export const profileRoutes = {
  index: routePaths.profile,
  edit: routePaths.editProfile,
} as const;

export type ProfileRoute = (typeof profileRoutes)[keyof typeof profileRoutes];

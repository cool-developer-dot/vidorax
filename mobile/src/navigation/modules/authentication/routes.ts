import { routePaths } from '../../constants/route-paths';

export const authenticationRoutes = {
  signIn: routePaths.signIn,
  signUp: routePaths.signUp,
  forgotPassword: routePaths.forgotPassword,
} as const;

export type AuthenticationRoute =
  (typeof authenticationRoutes)[keyof typeof authenticationRoutes];

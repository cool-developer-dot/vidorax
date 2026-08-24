import { env } from '../../config/index.js';

export const jwtConfig = {
  accessSecret: env.jwtAccessSecret,
  refreshSecret: env.jwtRefreshSecret,
  accessExpiresIn: env.jwtAccessExpiresIn,
  refreshExpiresIn: env.jwtRefreshExpiresIn,
} as const;

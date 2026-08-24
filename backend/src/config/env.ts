import dotenv from 'dotenv';

dotenv.config();

const INSECURE_JWT_DEFAULTS = new Set([
  'dev-access-secret-change-me',
  'dev-refresh-secret-change-me',
  'change-me-access-secret',
  'change-me-refresh-secret',
]);

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue;

  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const nodeEnv = getEnv('NODE_ENV', 'development');
const jwtAccessSecret = getEnv('JWT_ACCESS_SECRET', 'dev-access-secret-change-me');
const jwtRefreshSecret = getEnv(
  'JWT_REFRESH_SECRET',
  'dev-refresh-secret-change-me',
);
const corsOrigin = getEnv('CORS_ORIGIN', '*');

if (nodeEnv === 'production') {
  if (
    INSECURE_JWT_DEFAULTS.has(jwtAccessSecret) ||
    INSECURE_JWT_DEFAULTS.has(jwtRefreshSecret)
  ) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set to strong, non-default values in production',
    );
  }

  if (corsOrigin === '*') {
    throw new Error(
      'CORS_ORIGIN must be an explicit allowlist in production (wildcard is not permitted)',
    );
  }
}

export const env = {
  nodeEnv,
  port: Number(getEnv('PORT', '3105')),
  databaseUrl: getEnv('DATABASE_URL'),
  directDatabaseUrl: process.env.DIRECT_URL ?? '',
  jwtAccessSecret,
  jwtRefreshSecret,
  jwtAccessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  corsOrigin,
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  supabaseAvatarBucket: getEnv('SUPABASE_AVATAR_BUCKET', 'avatars'),
  avatarMaxBytes: Number(getEnv('AVATAR_MAX_BYTES', '2097152')),
} as const;

export const isAvatarStorageConfigured = (): boolean =>
  env.supabaseUrl.length > 0 && env.supabaseServiceRoleKey.length > 0;

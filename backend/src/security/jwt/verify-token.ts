import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../../types/auth.types.js';
import { jwtConfig } from './config.js';

const VERIFY_OPTIONS = {
  algorithms: ['HS256'] as jwt.Algorithm[],
};

export const verifyAccessToken = (token: string): JwtPayload => {
  const payload = jwt.verify(
    token,
    jwtConfig.accessSecret,
    VERIFY_OPTIONS,
  ) as JwtPayload;

  if (payload.type !== 'access') {
    throw new Error('Invalid access token');
  }

  return payload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  const payload = jwt.verify(
    token,
    jwtConfig.refreshSecret,
    VERIFY_OPTIONS,
  ) as JwtPayload;

  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }

  return payload;
};

export const decodeToken = (token: string): JwtPayload | null => {
  const decoded = jwt.decode(token);

  if (!decoded || typeof decoded === 'string') {
    return null;
  }

  return decoded as JwtPayload;
};

import jwt, { type SignOptions } from 'jsonwebtoken';
import type { JwtPayload } from '../../types/auth.types.js';
import { jwtConfig } from './config.js';

type TokenPayload = Omit<JwtPayload, 'type'>;

const accessSignOptions: SignOptions = {
  expiresIn: jwtConfig.accessExpiresIn as SignOptions['expiresIn'],
};

const refreshSignOptions: SignOptions = {
  expiresIn: jwtConfig.refreshExpiresIn as SignOptions['expiresIn'],
};

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, type: 'access' }, jwtConfig.accessSecret, accessSignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, type: 'refresh' }, jwtConfig.refreshSecret, refreshSignOptions);
};

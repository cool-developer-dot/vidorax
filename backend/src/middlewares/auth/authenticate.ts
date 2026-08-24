import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../security/jwt/index.js';
import type { AuthenticatedRequest } from '../../types/auth.types.js';
import { unauthorized } from '../../utils/response/index.js';

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    unauthorized(res, 'Access token is required');
    return;
  }

  const token = authHeader.slice(7);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    unauthorized(res, 'Invalid or expired access token');
  }
};

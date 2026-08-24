import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../security/jwt/index.js';
import type { AuthenticatedRequest } from '../../types/auth.types.js';

export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Intentionally ignore invalid tokens for optional auth
  }

  next();
};

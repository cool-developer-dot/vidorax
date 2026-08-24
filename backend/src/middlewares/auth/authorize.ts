import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../types/auth.types.js';
import { forbidden, unauthorized } from '../../utils/response/index.js';

export const authorize =
  (...roles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      forbidden(res);
      return;
    }

    next();
  };

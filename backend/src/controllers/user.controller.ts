import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import * as userService from '../services/user.service.js';
import { success, unauthorized } from '../utils/response/index.js';
import { handleServiceError } from '../utils/handle-service-error.js';

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const profile = await userService.getProfile(req.user.sub);
    success(res, { user: profile });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const updateMe = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const profile = await userService.updateProfile(req.user.sub, {
      name: req.body.name,
    });

    success(res, { user: profile });
  } catch (error) {
    handleServiceError(error, res);
  }
};

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import * as avatarService from '../services/avatar.service.js';
import { created, success, unauthorized } from '../utils/response/index.js';
import { handleServiceError } from '../utils/handle-service-error.js';

export const createAvatarUploadUrl = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const ticket = await avatarService.createUploadTicket(req.user.sub);
    created(res, { upload: ticket });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const commitAvatar = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const profile = await avatarService.commitUpload(req.user.sub, req.body.path);
    success(res, { user: profile });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const deleteAvatar = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const profile = await avatarService.removeAvatar(req.user.sub);
    success(res, { user: profile });
  } catch (error) {
    handleServiceError(error, res);
  }
};

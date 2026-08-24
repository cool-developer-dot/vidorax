import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import * as mediaOrganizationService from '../services/media-organization.service.js';
import { success, unauthorized } from '../utils/response/index.js';
import { handleServiceError } from '../utils/handle-service-error.js';

export const patchMediaFavorite = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await mediaOrganizationService.patchMediaFavorite(
      req.user.sub,
      req.params.id as string,
      Boolean(req.body.favorite),
    );

    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const patchMediaFolder = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await mediaOrganizationService.patchMediaFolder(
      req.user.sub,
      req.params.id as string,
      req.body.folderId === null ? null : (req.body.folderId as string | null),
    );

    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};


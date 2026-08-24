import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import * as mediaMetadataService from '../services/media-metadata.service.js';
import { success, unauthorized } from '../utils/response/index.js';
import { handleServiceError } from '../utils/handle-service-error.js';

export const renameMedia = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await mediaMetadataService.renameMedia(
      req.user.sub,
      req.params.id as string,
      { displayName: String(req.body.displayName) },
    );

    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const deleteMedia = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await mediaMetadataService.deleteMedia(
      req.user.sub,
      req.params.id as string,
    );

    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};


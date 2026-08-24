import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import * as mediaFolderService from '../services/media-folder.service.js';
import { created, success, unauthorized } from '../utils/response/index.js';
import { handleServiceError } from '../utils/handle-service-error.js';
import { AppError } from '../utils/errors/index.js';

export const listMediaFolders = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const items = await mediaFolderService.listFolders(req.user.sub);
    success(res, { items });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const createMediaFolder = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const folder = await mediaFolderService.createFolder(req.user.sub, {
      name: req.body.name,
    });

    created(res, { folder });
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

    const folder = await mediaFolderService.renameFolder(
      req.user.sub,
      req.params.id as string,
      { name: req.body.name },
    );

    if (!folder) {
      throw new AppError('Folder not found', 404);
    }

    success(res, { folder });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const deleteMediaFolder = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const deleted = await mediaFolderService.deleteFolder(
      req.user.sub,
      req.params.id as string,
    );

    if (!deleted) {
      throw new AppError('Folder not found', 404);
    }

    success(res, { message: 'Folder deleted' });
  } catch (error) {
    handleServiceError(error, res);
  }
};


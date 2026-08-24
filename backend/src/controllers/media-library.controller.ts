import type { Response } from 'express';
import * as mediaLibraryService from '../services/media-library.service.js';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import type { MediaLibrarySort } from '../types/media-library.types.js';
import { handleServiceError } from '../utils/handle-service-error.js';
import { parsePagination } from '../utils/pagination.js';
import { success, unauthorized } from '../utils/response/index.js';

function parseFavoriteQuery(value: unknown): boolean | undefined {
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  return undefined;
}

export const listMediaLibrary = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await mediaLibraryService.listMediaLibrary(
      req.user.sub,
      parsePagination(req.query as Record<string, unknown>),
      {
        sort:
          typeof req.query.sort === 'string'
            ? (req.query.sort as MediaLibrarySort)
            : undefined,
        favorite: parseFavoriteQuery(req.query.favorite),
        folderId:
          typeof req.query.folderId === 'string' ? req.query.folderId : undefined,
      },
    );

    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const getMediaLibraryItem = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const media = await mediaLibraryService.getMediaLibraryItem(
      req.user.sub,
      req.params.id as string,
    );
    success(res, { media });
  } catch (error) {
    handleServiceError(error, res);
  }
};

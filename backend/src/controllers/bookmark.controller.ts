import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import * as bookmarkService from '../services/bookmark.service.js';
import { created, success, unauthorized } from '../utils/response/index.js';
import { handleServiceError } from '../utils/handle-service-error.js';
import {
  parsePagination,
  type ListSort,
} from '../utils/pagination.js';

export const listBookmarks = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await bookmarkService.listBookmarks(
      req.user.sub,
      parsePagination(req.query as Record<string, unknown>),
      {
        search:
          typeof req.query.search === 'string' ? req.query.search : undefined,
        sort:
          typeof req.query.sort === 'string'
            ? (req.query.sort as ListSort)
            : undefined,
      },
    );

    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const createBookmark = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const bookmark = await bookmarkService.createBookmark(req.user.sub, {
      url: req.body.url,
      title: req.body.title,
      faviconUrl: req.body.faviconUrl,
    });

    created(res, { bookmark });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const updateBookmark = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const bookmark = await bookmarkService.updateBookmark(
      req.user.sub,
      req.params.id as string,
      {
        url: req.body.url,
        title: req.body.title,
        faviconUrl: req.body.faviconUrl,
      },
    );

    success(res, { bookmark });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const deleteBookmark = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    await bookmarkService.deleteBookmark(
      req.user.sub,
      req.params.id as string,
    );
    success(res, { message: 'Bookmark deleted' });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const clearBookmarks = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await bookmarkService.clearBookmarks(req.user.sub);
    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

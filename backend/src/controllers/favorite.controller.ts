import type { FavoritePlatform } from '@prisma/client';
import type { Response } from 'express';
import * as favoriteService from '../services/favorite.service.js';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import { AppError } from '../utils/errors/index.js';
import {
  parsePagination,
  type ListSort,
} from '../utils/pagination.js';
import { created, success } from '../utils/response/index.js';

const getUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  return req.user.sub;
};

export const createFavorite = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const favorite = await favoriteService.createFavorite(getUserId(req), {
    title: req.body.title,
    platform: req.body.platform as FavoritePlatform,
    sourceUrl: req.body.sourceUrl,
    thumbnailUrl: req.body.thumbnailUrl,
  });

  created(res, { favorite });
};

export const listFavorites = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const result = await favoriteService.listFavorites(
    getUserId(req),
    parsePagination(req.query as Record<string, unknown>),
    {
      search:
        typeof req.query.search === 'string' ? req.query.search : undefined,
      platform:
        typeof req.query.platform === 'string'
          ? (req.query.platform as FavoritePlatform)
          : undefined,
      sort:
        typeof req.query.sort === 'string'
          ? (req.query.sort as ListSort)
          : undefined,
    },
  );

  success(res, result);
};

export const deleteFavorite = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  await favoriteService.deleteFavorite(
    getUserId(req),
    req.params.id as string,
  );
  success(res, { message: 'Favorite deleted' });
};

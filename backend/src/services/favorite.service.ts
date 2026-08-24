import * as favoriteRepository from '../repositories/favorite.repository.js';
import type {
  CreateFavoriteInput,
  FavoriteItem,
  FavoriteListFilters,
} from '../types/favorite.types.js';
import { AppError } from '../utils/errors/index.js';
import {
  buildPaginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from '../utils/pagination.js';
import { InvalidUrlError, normalizeUrl } from '../utils/url.js';

const toFavoriteItem = (
  favorite: favoriteRepository.FavoriteRecord,
): FavoriteItem => ({
  id: favorite.id,
  title: favorite.title,
  platform: favorite.platform,
  sourceUrl: favorite.sourceUrl,
  thumbnailUrl: favorite.thumbnailUrl,
  createdAt: favorite.createdAt,
});

const resolveUrl = (value: string): string => {
  try {
    return normalizeUrl(value);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      throw new AppError(error.message, 400);
    }

    throw error;
  }
};

export const createFavorite = async (
  userId: string,
  input: CreateFavoriteInput,
): Promise<FavoriteItem> => {
  try {
    const favorite = await favoriteRepository.create({
      title: input.title.trim(),
      platform: input.platform,
      sourceUrl: resolveUrl(input.sourceUrl),
      thumbnailUrl: resolveUrl(input.thumbnailUrl),
      user: {
        connect: { id: userId },
      },
    });

    return toFavoriteItem(favorite);
  } catch (error) {
    if (error instanceof favoriteRepository.UniqueConstraintError) {
      throw new AppError('Favorite already exists for this source URL', 409);
    }

    throw error;
  }
};

export const listFavorites = async (
  userId: string,
  pagination: PaginationParams,
  filters: FavoriteListFilters = {},
): Promise<PaginatedResult<FavoriteItem>> => {
  const { items, total } = await favoriteRepository.listForUser(
    userId,
    pagination,
    {
      search: filters.search?.trim() || undefined,
      platform: filters.platform,
      sort: filters.sort ?? 'newest',
    },
  );

  return buildPaginatedResult(items.map(toFavoriteItem), total, pagination);
};

export const deleteFavorite = async (
  userId: string,
  id: string,
): Promise<void> => {
  const deleted = await favoriteRepository.deleteForUser(id, userId);

  if (deleted === 0) {
    throw new AppError('Favorite not found', 404);
  }
};

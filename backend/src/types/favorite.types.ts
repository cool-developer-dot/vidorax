import type { FavoritePlatform } from '@prisma/client';
import type { ListSort } from '../utils/pagination.js';

export const FAVORITE_PLATFORMS = [
  'YOUTUBE',
  'FACEBOOK',
  'INSTAGRAM',
  'TIKTOK',
  'X',
  'VIMEO',
  'DAILYMOTION',
  'OTHER',
] as const satisfies readonly FavoritePlatform[];

export interface FavoriteItem {
  id: string;
  title: string;
  platform: FavoritePlatform;
  sourceUrl: string;
  thumbnailUrl: string;
  createdAt: Date;
}

export interface CreateFavoriteInput {
  title: string;
  platform: FavoritePlatform;
  sourceUrl: string;
  thumbnailUrl: string;
}

export interface FavoriteListFilters {
  search?: string;
  platform?: FavoritePlatform;
  sort?: ListSort;
}

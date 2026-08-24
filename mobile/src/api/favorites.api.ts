import { del, get, post } from './request';
import type {
  CreateFavoriteRequest,
  CreateFavoriteResponse,
  DeleteFavoriteResponse,
  FavoriteListResponse,
  ListFavoritesParams,
} from './types';

function buildListQuery(params: ListFavoritesParams = {}): string {
  const search = new URLSearchParams();

  if (params.page !== undefined) {
    search.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  if (params.search?.trim()) {
    search.set('search', params.search.trim());
  }
  if (params.platform) {
    search.set('platform', params.platform);
  }
  if (params.sort) {
    search.set('sort', params.sort);
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listFavorites(
  params: ListFavoritesParams = {},
  config?: { signal?: AbortSignal },
): Promise<FavoriteListResponse> {
  return get<FavoriteListResponse>(`/favorites${buildListQuery(params)}`, {
    signal: config?.signal,
  });
}

export async function createFavorite(
  payload: CreateFavoriteRequest,
  config?: { signal?: AbortSignal },
): Promise<CreateFavoriteResponse['favorite']> {
  const response = await post<CreateFavoriteResponse, CreateFavoriteRequest>(
    '/favorites',
    payload,
    { signal: config?.signal },
  );
  return response.favorite;
}

export async function deleteFavorite(
  id: string,
  config?: { signal?: AbortSignal },
): Promise<DeleteFavoriteResponse> {
  return del<DeleteFavoriteResponse>(`/favorites/${id}`, {
    signal: config?.signal,
  });
}

export const favoritesApi = {
  listFavorites,
  createFavorite,
  deleteFavorite,
} as const;

import { del, get, patch, post } from './request';
import type {
  BookmarkListResponse,
  ClearBookmarksResponse,
  CreateBookmarkRequest,
  CreateBookmarkResponse,
  DeleteBookmarkResponse,
  ListBookmarksParams,
  UpdateBookmarkRequest,
  UpdateBookmarkResponse,
} from './types';

function buildListQuery(params: ListBookmarksParams = {}): string {
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
  if (params.sort) {
    search.set('sort', params.sort);
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listBookmarks(
  params: ListBookmarksParams = {},
  config?: { signal?: AbortSignal },
): Promise<BookmarkListResponse> {
  return get<BookmarkListResponse>(`/bookmarks${buildListQuery(params)}`, {
    signal: config?.signal,
  });
}

export async function createBookmark(
  payload: CreateBookmarkRequest,
  config?: { signal?: AbortSignal },
): Promise<CreateBookmarkResponse['bookmark']> {
  const response = await post<CreateBookmarkResponse, CreateBookmarkRequest>(
    '/bookmarks',
    payload,
    { signal: config?.signal },
  );
  return response.bookmark;
}

export async function updateBookmark(
  id: string,
  payload: UpdateBookmarkRequest,
  config?: { signal?: AbortSignal },
): Promise<UpdateBookmarkResponse['bookmark']> {
  const response = await patch<UpdateBookmarkResponse, UpdateBookmarkRequest>(
    `/bookmarks/${id}`,
    payload,
    { signal: config?.signal },
  );
  return response.bookmark;
}

export async function deleteBookmark(
  id: string,
  config?: { signal?: AbortSignal },
): Promise<DeleteBookmarkResponse> {
  return del<DeleteBookmarkResponse>(`/bookmarks/${id}`, {
    signal: config?.signal,
  });
}

export async function clearBookmarks(
  config?: { signal?: AbortSignal },
): Promise<ClearBookmarksResponse> {
  return del<ClearBookmarksResponse>('/bookmarks', { signal: config?.signal });
}

export const bookmarksApi = {
  listBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  clearBookmarks,
} as const;

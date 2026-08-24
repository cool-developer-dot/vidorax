import { del, get, post } from './request';
import type {
  ClearHistoryResponse,
  CreateHistoryRequest,
  CreateHistoryResponse,
  DeleteHistoryResponse,
  HistoryListResponse,
  ListHistoryParams,
  RecentUrlsResponse,
} from './types';

function buildListQuery(params: ListHistoryParams = {}): string {
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
  if (params.hostname?.trim()) {
    search.set('hostname', params.hostname.trim());
  }
  if (params.sort) {
    search.set('sort', params.sort);
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listHistory(
  params: ListHistoryParams = {},
  config?: { signal?: AbortSignal },
): Promise<HistoryListResponse> {
  return get<HistoryListResponse>(`/history${buildListQuery(params)}`, {
    signal: config?.signal,
  });
}

export async function createHistory(
  payload: CreateHistoryRequest,
  config?: { signal?: AbortSignal },
): Promise<CreateHistoryResponse['history']> {
  const response = await post<CreateHistoryResponse, CreateHistoryRequest>(
    '/history',
    payload,
    { signal: config?.signal },
  );
  return response.history;
}

export async function getRecentUrls(
  limit?: number,
  config?: { signal?: AbortSignal },
): Promise<RecentUrlsResponse['urls']> {
  const query = limit !== undefined ? `?limit=${limit}` : '';
  const response = await get<RecentUrlsResponse>(`/history/recent${query}`, {
    signal: config?.signal,
  });
  return response.urls;
}

export async function clearHistory(
  config?: { signal?: AbortSignal },
): Promise<ClearHistoryResponse> {
  return del<ClearHistoryResponse>('/history', { signal: config?.signal });
}

export async function deleteHistory(
  id: string,
  config?: { signal?: AbortSignal },
): Promise<DeleteHistoryResponse> {
  return del<DeleteHistoryResponse>(`/history/${id}`, { signal: config?.signal });
}

export const historyApi = {
  listHistory,
  createHistory,
  getRecentUrls,
  clearHistory,
  deleteHistory,
} as const;

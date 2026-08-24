import { del, get, patch, post } from './request';
import type {
  AnalyzeDownloadRequest,
  AnalyzeDownloadResponse,
  CreateDownloadRequest,
  CreateDownloadResponse,
  DeleteDownloadResponse,
  DownloadItem,
  DownloadListResponse,
  GetDownloadResponse,
  ListDownloadsParams,
  MediaAnalysisResult,
  UpdateDownloadRequest,
  UpdateDownloadResponse,
} from './types';

function buildListQuery(params: ListDownloadsParams = {}): string {
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
  if (params.status) {
    search.set('status', params.status);
  }
  if (params.platform?.trim()) {
    search.set('platform', params.platform.trim());
  }
  if (params.sort) {
    search.set('sort', params.sort);
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function analyzeDownload(
  payload: AnalyzeDownloadRequest,
  config?: { signal?: AbortSignal },
): Promise<MediaAnalysisResult> {
  const response = await post<AnalyzeDownloadResponse, AnalyzeDownloadRequest>(
    '/downloads/analyze',
    payload,
    { signal: config?.signal },
  );
  return response.analysis;
}

export async function listDownloads(
  params: ListDownloadsParams = {},
  config?: { signal?: AbortSignal },
): Promise<DownloadListResponse> {
  return get<DownloadListResponse>(`/downloads${buildListQuery(params)}`, {
    signal: config?.signal,
  });
}

export async function getDownload(
  id: string,
  config?: { signal?: AbortSignal },
): Promise<DownloadItem> {
  const response = await get<GetDownloadResponse>(`/downloads/${id}`, {
    signal: config?.signal,
  });
  return response.download;
}

export async function createDownload(
  payload: CreateDownloadRequest,
  config?: { signal?: AbortSignal },
): Promise<DownloadItem> {
  const response = await post<CreateDownloadResponse, CreateDownloadRequest>(
    '/downloads',
    payload,
    { signal: config?.signal },
  );
  return response.download;
}

export async function updateDownload(
  id: string,
  payload: UpdateDownloadRequest,
  config?: { signal?: AbortSignal },
): Promise<DownloadItem> {
  const response = await patch<UpdateDownloadResponse, UpdateDownloadRequest>(
    `/downloads/${id}`,
    payload,
    { signal: config?.signal },
  );
  return response.download;
}

export async function deleteDownload(
  id: string,
  config?: { signal?: AbortSignal },
): Promise<DeleteDownloadResponse> {
  return del<DeleteDownloadResponse>(`/downloads/${id}`, {
    signal: config?.signal,
  });
}

export const downloadsApi = {
  analyzeDownload,
  listDownloads,
  getDownload,
  createDownload,
  updateDownload,
  deleteDownload,
} as const;

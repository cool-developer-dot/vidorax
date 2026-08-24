import { del, get, put } from './request';
import type {
  DeletePlaybackResponse,
  GetPlaybackResponse,
  ListPlaybackParams,
  PlaybackListResponse,
  PlaybackRecentResponse,
  PlaybackRemoteDto,
  UpdatePlaybackProgressRequest,
  UpdatePlaybackProgressResponse,
} from './types';

function buildListQuery(params: ListPlaybackParams = {}): string {
  const search = new URLSearchParams();
  if (params.page !== undefined) {
    search.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function getPlayback(
  mediaId: string,
  config?: { signal?: AbortSignal },
): Promise<PlaybackRemoteDto> {
  const response = await get<GetPlaybackResponse>(`/playback/${mediaId}`, {
    signal: config?.signal,
  });
  return response.playback;
}

export async function updatePlaybackProgress(
  mediaId: string,
  body: UpdatePlaybackProgressRequest,
  config?: { signal?: AbortSignal },
): Promise<PlaybackRemoteDto> {
  const response = await put<
    UpdatePlaybackProgressResponse,
    UpdatePlaybackProgressRequest
  >(`/playback/${mediaId}/progress`, body, { signal: config?.signal });
  return response.playback;
}

export async function listPlaybackHistory(
  params: ListPlaybackParams = {},
  config?: { signal?: AbortSignal },
): Promise<PlaybackListResponse> {
  return get<PlaybackListResponse>(
    `/playback/history${buildListQuery(params)}`,
    { signal: config?.signal },
  );
}

export async function listContinueWatching(
  params: ListPlaybackParams = {},
  config?: { signal?: AbortSignal },
): Promise<PlaybackListResponse> {
  return get<PlaybackListResponse>(
    `/playback/continue-watching${buildListQuery(params)}`,
    { signal: config?.signal },
  );
}

export async function listRecentPlayback(
  params: { limit?: number } = {},
  config?: { signal?: AbortSignal },
): Promise<PlaybackRecentResponse> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return get<PlaybackRecentResponse>(
    `/playback/recent${query ? `?${query}` : ''}`,
    { signal: config?.signal },
  );
}

export async function deletePlaybackHistory(
  mediaId: string,
  config?: { signal?: AbortSignal },
): Promise<DeletePlaybackResponse> {
  return del<DeletePlaybackResponse>(`/playback/${mediaId}`, {
    signal: config?.signal,
  });
}

export const playbackApi = {
  getPlayback,
  updatePlaybackProgress,
  listPlaybackHistory,
  listContinueWatching,
  listRecentPlayback,
  deletePlaybackHistory,
} as const;

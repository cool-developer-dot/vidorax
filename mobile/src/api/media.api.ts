import { del, get, patch, post } from './request';
import type {
  CreateMediaFolderInput,
  CreateMediaFolderResponse,
  DeleteMediaFolderResponse,
  DeleteMediaResponse,
  ListMediaFoldersResponse,
  GetMediaLibraryItemResponse,
  ListMediaLibraryParams,
  MediaLibraryListResponse,
  MediaLibraryRemoteItem,
  PatchMediaFolderAssignmentRequest,
  PatchMediaFolderAssignmentResponse,
  PatchMediaFavoriteRequest,
  PatchMediaFavoriteResponse,
  PatchMediaFolderRenameInput,
  PatchMediaFolderRenameResponse,
  PatchMediaRenameRequest,
  PatchMediaRenameResponse,
} from './types';

function buildListQuery(params: ListMediaLibraryParams = {}): string {
  const search = new URLSearchParams();

  if (params.page !== undefined) {
    search.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  if (params.sort) {
    search.set('sort', params.sort);
  }
  if (params.favorite !== undefined) {
    search.set('favorite', params.favorite ? 'true' : 'false');
  }
  if (params.folderId?.trim()) {
    search.set('folderId', params.folderId.trim());
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listMediaLibrary(
  params: ListMediaLibraryParams = {},
  config?: { signal?: AbortSignal },
): Promise<MediaLibraryListResponse> {
  return get<MediaLibraryListResponse>(
    `/media/library${buildListQuery(params)}`,
    { signal: config?.signal },
  );
}

export async function getMediaLibraryItem(
  id: string,
  config?: { signal?: AbortSignal },
): Promise<MediaLibraryRemoteItem> {
  const response = await get<GetMediaLibraryItemResponse>(`/media/${id}`, {
    signal: config?.signal,
  });
  return response.media;
}

export async function listMediaFolders(
  config?: { signal?: AbortSignal },
): Promise<ListMediaFoldersResponse> {
  return get<ListMediaFoldersResponse>(`/media/folders`, { signal: config?.signal });
}

export async function createMediaFolder(
  input: CreateMediaFolderInput,
  config?: { signal?: AbortSignal },
): Promise<CreateMediaFolderResponse['folder']> {
  const response = await post<CreateMediaFolderResponse, CreateMediaFolderInput>(
    '/media/folders',
    input,
    { signal: config?.signal },
  );
  return response.folder;
}

export async function patchMediaFolderRename(
  id: string,
  input: PatchMediaFolderRenameInput,
  config?: { signal?: AbortSignal },
): Promise<PatchMediaFolderRenameResponse['folder']> {
  const response = await patch<PatchMediaFolderRenameResponse, PatchMediaFolderRenameInput>(
    `/media/folders/${id}`,
    input,
    { signal: config?.signal },
  );
  return response.folder;
}

export async function deleteMediaFolder(
  id: string,
  config?: { signal?: AbortSignal },
): Promise<DeleteMediaFolderResponse> {
  return del<DeleteMediaFolderResponse>(`/media/folders/${id}`, {
    signal: config?.signal,
  });
}

export async function patchMediaFavorite(
  id: string,
  input: PatchMediaFavoriteRequest,
  config?: { signal?: AbortSignal },
): Promise<PatchMediaFavoriteResponse> {
  return patch<PatchMediaFavoriteResponse, PatchMediaFavoriteRequest>(
    `/media/${id}/favorite`,
    input,
    { signal: config?.signal },
  );
}

export async function patchMediaFolderAssignment(
  id: string,
  input: PatchMediaFolderAssignmentRequest,
  config?: { signal?: AbortSignal },
): Promise<PatchMediaFolderAssignmentResponse> {
  return patch<PatchMediaFolderAssignmentResponse, PatchMediaFolderAssignmentRequest>(
    `/media/${id}/folder`,
    input,
    { signal: config?.signal },
  );
}

export async function patchMediaRename(
  id: string,
  input: PatchMediaRenameRequest,
  config?: { signal?: AbortSignal },
): Promise<PatchMediaRenameResponse> {
  return patch<PatchMediaRenameResponse, PatchMediaRenameRequest>(
    `/media/${id}/rename`,
    input,
    { signal: config?.signal },
  );
}

export async function deleteMedia(
  id: string,
  config?: { signal?: AbortSignal },
): Promise<DeleteMediaResponse> {
  return del<DeleteMediaResponse>(`/media/${id}`, { signal: config?.signal });
}

export const mediaApi = {
  listMediaLibrary,
  getMediaLibraryItem,
  listMediaFolders,
  createMediaFolder,
  patchMediaFolderRename,
  deleteMediaFolder,
  patchMediaFavorite,
  patchMediaFolderAssignment,
  patchMediaRename,
  deleteMedia,
} as const;

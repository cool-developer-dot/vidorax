import { listMediaLibrary } from '@/api';
import type { MediaLibraryRemoteItem } from '@/api';

import { LIBRARY_REMOTE_MAX_PAGES, LIBRARY_REMOTE_PAGE_SIZE } from './constants';
import { normalizeThumbnailUri } from './mapper';
import type { MediaLibraryRemoteItem as CanonicalRemote } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeRemoteMediaItem(
  raw: unknown,
): CanonicalRemote | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : typeof raw.downloadId === 'string' && raw.downloadId.trim()
        ? raw.downloadId.trim()
        : null;
  const fileName = typeof raw.fileName === 'string' ? raw.fileName.trim() : '';
  const displayName =
    typeof raw.displayName === 'string' && raw.displayName.trim()
      ? raw.displayName.trim()
      : fileName;
  if (!id || !fileName || !displayName) {
    return null;
  }

  return {
    id,
    downloadId:
      typeof raw.downloadId === 'string' && raw.downloadId.trim()
        ? raw.downloadId.trim()
        : id,
    displayName,
    fileName,
    mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : null,
    fileSize:
      typeof raw.fileSize === 'string'
        ? raw.fileSize
        : typeof raw.fileSize === 'number'
          ? String(Math.trunc(raw.fileSize))
          : '0',
    quality: typeof raw.quality === 'string' ? raw.quality : null,
    resolution: typeof raw.resolution === 'string' ? raw.resolution : null,
    bitrate:
      typeof raw.bitrate === 'number' && Number.isFinite(raw.bitrate)
        ? Math.trunc(raw.bitrate)
        : null,
    duration:
      typeof raw.duration === 'number' && Number.isFinite(raw.duration)
        ? raw.duration
        : null,
    downloadedAt:
      typeof raw.downloadedAt === 'string' ? raw.downloadedAt : null,
    favorite: raw.favorite === true,
    folderId: typeof raw.folderId === 'string' ? raw.folderId : null,
    folderName: typeof raw.folderName === 'string' ? raw.folderName : null,
    thumbnailUrl: normalizeThumbnailUri(raw.thumbnailUrl),
  };
}

export async function fetchAllMediaLibraryPages(
  signal?: AbortSignal,
): Promise<MediaLibraryRemoteItem[]> {
  const items: MediaLibraryRemoteItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= LIBRARY_REMOTE_MAX_PAGES) {
    const response = await listMediaLibrary(
      { page, limit: LIBRARY_REMOTE_PAGE_SIZE, sort: 'newest' },
      { signal },
    );
    const batch = Array.isArray(response.items) ? response.items : [];
    for (const raw of batch) {
      const normalized = normalizeRemoteMediaItem(raw);
      if (normalized) {
        items.push(normalized);
      }
    }
    hasMore = Boolean(response.pagination?.hasMore) && batch.length > 0;
    page += 1;
  }

  return items;
}

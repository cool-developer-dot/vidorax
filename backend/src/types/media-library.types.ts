export const MEDIA_LIBRARY_SORTS = [
  'newest',
  'oldest',
  'name_asc',
  'name_desc',
  'largest',
  'smallest',
] as const;

export type MediaLibrarySort = (typeof MEDIA_LIBRARY_SORTS)[number];

/**
 * Safe library metadata DTO.
 * Never includes device paths, source URLs, cookies, or worker internals.
 */
export interface MediaLibraryItem {
  id: string;
  downloadId: string;
  displayName: string;
  fileName: string;
  mimeType: string | null;
  fileSize: string;
  quality: string | null;
  resolution: string | null;
  bitrate: number | null;
  duration: number | null;
  downloadedAt: Date | null;
  favorite: boolean;
  folderId: string | null;
  folderName: string | null;
  thumbnailUrl: string | null;
}

export interface MediaLibraryListFilters {
  sort?: MediaLibrarySort;
  favorite?: boolean;
  folderId?: string | null;
}

import { DownloadStatus } from '@prisma/client';
import { toMediaLibraryItem } from '../domain/media-library/index.js';
import * as downloadRepository from '../repositories/download.repository.js';
import * as favoriteRepository from '../repositories/favorite.repository.js';
import * as mediaFolderRepository from '../repositories/media-folder.repository.js';
import type {
  MediaLibraryItem,
  MediaLibraryListFilters,
} from '../types/media-library.types.js';
import { AppError } from '../utils/errors/index.js';
import {
  buildPaginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from '../utils/pagination.js';

export const listMediaLibrary = async (
  userId: string,
  pagination: PaginationParams,
  filters: MediaLibraryListFilters = {},
): Promise<PaginatedResult<MediaLibraryItem>> => {
  let sourceUrls: string[] | undefined;
  if (filters.favorite === true) {
    sourceUrls = await favoriteRepository.listSourceUrlsForUser(userId);
    if (sourceUrls.length === 0) {
      return buildPaginatedResult([], 0, pagination);
    }
  }

  const { items, total } = await downloadRepository.listCompletedLibraryForUser(
    userId,
    pagination,
    {
      sort: filters.sort ?? 'newest',
      sourceUrls,
      folderId: filters.folderId ?? undefined,
    },
  );

  const favoriteUrls = await favoriteRepository.findMatchingSourceUrls(
    userId,
    items.map((item) => item.sourceUrl),
  );

  const folderIds = items
    .map((item) => item.folderId)
    .filter((id): id is string => Boolean(id));

  const folderNames = await mediaFolderRepository.findNamesByIdsForUser(
    userId,
    folderIds,
  );
  const folderNameById = new Map(folderNames.map((f) => [f.id, f.name]));

  const media = items
    .map((item) =>
      toMediaLibraryItem(
        item,
        favoriteUrls.has(item.sourceUrl),
        item.folderId ? folderNameById.get(item.folderId) ?? null : null,
      ),
    )
    .filter((item): item is MediaLibraryItem => item != null);

  return buildPaginatedResult(media, total, pagination);
};

export const getMediaLibraryItem = async (
  userId: string,
  id: string,
): Promise<MediaLibraryItem> => {
  const download = await downloadRepository.findCompletedByIdForUser(id, userId);

  if (!download) {
    throw new AppError('Media not found', 404);
  }

  if (download.status !== DownloadStatus.COMPLETED) {
    throw new AppError('Media not found', 404);
  }

  const favoriteUrls = await favoriteRepository.findMatchingSourceUrls(userId, [
    download.sourceUrl,
  ]);

  const folderName =
    download.folderId == null
      ? null
      : (await mediaFolderRepository.findByIdForUser(
          userId,
          download.folderId,
        ))?.name ?? null;

  const media = toMediaLibraryItem(
    download,
    favoriteUrls.has(download.sourceUrl),
    folderName,
  );

  if (!media) {
    throw new AppError('Media not found', 404);
  }

  return media;
};

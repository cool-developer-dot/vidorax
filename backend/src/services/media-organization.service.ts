import type { FavoritePlatform } from '@prisma/client';

import * as favoriteRepository from '../repositories/favorite.repository.js';
import * as favoriteService from './favorite.service.js';
import * as downloadRepository from '../repositories/download.repository.js';
import * as mediaFolderRepository from '../repositories/media-folder.repository.js';
import { AppError } from '../utils/errors/index.js';
import { normalizeUrl } from '../utils/url.js';

export const patchMediaFavorite = async (
  userId: string,
  mediaId: string,
  favorite: boolean,
): Promise<{ favorite: boolean }> => {
  const download = await downloadRepository.findCompletedByIdForUser(
    mediaId,
    userId,
  );

  if (!download) {
    throw new AppError('Media not found', 404);
  }

  if (favorite) {
    // Idempotent: create-or-noop when already favorited.
    try {
      await favoriteService.createFavorite(userId, {
        title: download.title.trim(),
        platform: download.platform as unknown as FavoritePlatform,
        sourceUrl: download.sourceUrl,
        thumbnailUrl: download.thumbnailUrl,
      });
      return { favorite: true };
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 409) {
        return { favorite: true };
      }
      throw error;
    }
  }

  // Idempotent delete: never error when absent.
  const normalizedSourceUrl = normalizeUrl(download.sourceUrl);
  await favoriteRepository.deleteBySourceUrlForUser(
    userId,
    normalizedSourceUrl,
  );
  return { favorite: false };
};

export const patchMediaFolder = async (
  userId: string,
  mediaId: string,
  folderId: string | null,
): Promise<{ folderId: string | null; folderName: string | null }> => {
  const download = await downloadRepository.findCompletedByIdForUser(
    mediaId,
    userId,
  );

  if (!download) {
    throw new AppError('Media not found', 404);
  }

  if (folderId != null) {
    const folder = await mediaFolderRepository.findByIdForUser(userId, folderId);
    if (!folder) {
      throw new AppError('Folder not found', 404);
    }

    const updated = await downloadRepository.updateFolderIdForCompletedByIdForUser(
      mediaId,
      userId,
      folderId,
    );

    if (!updated) {
      throw new AppError('Media not found', 404);
    }

    return { folderId, folderName: folder.name };
  }

  const updated = await downloadRepository.updateFolderIdForCompletedByIdForUser(
    mediaId,
    userId,
    null,
  );

  if (!updated) {
    throw new AppError('Media not found', 404);
  }

  return { folderId: null, folderName: 'Downloads / Unfiled' };
};


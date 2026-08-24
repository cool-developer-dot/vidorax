import { AppError } from '../utils/errors/index.js';
import * as downloadRepository from '../repositories/download.repository.js';
import * as favoriteRepository from '../repositories/favorite.repository.js';
import { withMediaOperationLock } from './media-operation-lock.js';
import { assertSafeFileName } from '../domain/downloads/sanitize.js';

export type RenameMediaInput = {
  displayName: string;
};

function splitFileName(input: string): { base: string; ext: string } {
  const trimmed = input.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) {
    return { base: trimmed, ext: '' };
  }
  return { base: trimmed.slice(0, dot), ext: trimmed.slice(dot + 1) };
}

function extensionOf(fileName: string): string {
  return splitFileName(fileName).ext.toLowerCase();
}

export async function renameMedia(
  userId: string,
  mediaId: string,
  input: RenameMediaInput,
): Promise<{
  id: string;
  title: string;
  fileName: string;
}> {
  const result = await withMediaOperationLock(mediaId, async () => {
    const download = await downloadRepository.findCompletedByIdForUser(
      mediaId,
      userId,
    );

    if (!download) {
      throw new AppError('Media not found', 404);
    }

    const currentExt = extensionOf(download.fileName);
    if (!currentExt) {
      throw new AppError('Media missing file extension', 400);
    }

    const raw = input.displayName.trim();
    const { base: rawBase, ext: rawExt } = splitFileName(raw);

    if (!rawBase) {
      throw new AppError('displayName is required', 400);
    }

    const normalizedExt = rawExt ? rawExt.toLowerCase() : '';
    if (normalizedExt && normalizedExt !== currentExt) {
      throw new AppError('Invalid file extension', 400);
    }

    const nextTitle = rawBase.trim();
    const nextFileName = assertSafeFileName(`${nextTitle}.${currentExt}`);

    // Idempotent: if unchanged, return current metadata.
    if (
      download.title === nextTitle &&
      download.fileName === nextFileName
    ) {
      return { id: download.id, title: download.title, fileName: download.fileName };
    }

    const collision = await downloadRepository.findCompletedByFileNameForUser(
      userId,
      nextFileName,
      download.id,
    );
    if (collision) {
      throw new AppError('A file with this name already exists', 409);
    }

    const updated = await downloadRepository.updateForUser(
      download.id,
      userId,
      { title: nextTitle, fileName: nextFileName },
      { expectedStatus: 'COMPLETED' },
    );

    if (!updated) {
      // Extremely rare: status changed between fetch and update.
      throw new AppError('Media not found', 404);
    }

    return { id: updated.id, title: updated.title, fileName: updated.fileName };
  });

  return result;
}

export async function deleteMedia(
  userId: string,
  mediaId: string,
): Promise<{ deleted: boolean }> {
  return withMediaOperationLock(mediaId, async () => {
    const download = await downloadRepository.findCompletedByIdForUser(
      mediaId,
      userId,
    );

    if (!download) {
      // Same response for missing and cross-user — no existence leak.
      return { deleted: false };
    }

    // Favorite cleanup: favorites are keyed by sourceUrl, not by DownloadHistory FK.
    await favoriteRepository.deleteBySourceUrlForUser(
      userId,
      download.sourceUrl,
    );

    const deleted = await downloadRepository.deleteForUser(mediaId, userId);
    if (deleted === 0) {
      throw new AppError('Media not found', 404);
    }

    return { deleted: true };
  });
}


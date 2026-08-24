import type { MediaFolderItem } from '../types/media-folder.types.js';
import type {
  CreateMediaFolderInput,
  RenameMediaFolderInput,
} from '../types/media-folder.types.js';
import * as mediaFolderRepository from '../repositories/media-folder.repository.js';
import { AppError } from '../utils/errors/index.js';

const DISPLAY_NAME_MAX = 100;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeFolderName(input: string): {
  name: string;
  normalizedName: string;
} {
  const trimmed = normalizeWhitespace(input);

  if (!trimmed) {
    throw new AppError('Folder name cannot be empty', 400);
  }

  if (CONTROL_CHARS_REGEX.test(trimmed)) {
    throw new AppError('Folder name contains invalid characters', 400);
  }

  if (
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.startsWith('..') ||
    /^\.+$/.test(trimmed)
  ) {
    throw new AppError('Folder name contains invalid characters', 400);
  }

  if (trimmed.length > DISPLAY_NAME_MAX) {
    throw new AppError(`Folder name must not exceed ${DISPLAY_NAME_MAX} characters`, 400);
  }

  return {
    name: trimmed,
    normalizedName: trimmed.toLowerCase(),
  };
}

function toItem(folder: mediaFolderRepository.MediaFolderRecord): MediaFolderItem {
  return {
    id: folder.id,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

export const listFolders = async (userId: string): Promise<MediaFolderItem[]> => {
  const folders = await mediaFolderRepository.listForUser(userId);
  return folders.map(toItem);
};

export const createFolder = async (
  userId: string,
  input: CreateMediaFolderInput,
): Promise<MediaFolderItem> => {
  const { name, normalizedName } = normalizeFolderName(input.name);

  try {
    const folder = await mediaFolderRepository.createForUser(userId, {
      name,
      normalizedName,
    });
    return toItem(folder);
  } catch (error) {
    if (error instanceof mediaFolderRepository.UniqueConstraintError) {
      throw new AppError('A folder with this name already exists', 409);
    }
    throw error;
  }
};

export const renameFolder = async (
  userId: string,
  id: string,
  input: RenameMediaFolderInput,
): Promise<MediaFolderItem | null> => {
  const existing = await mediaFolderRepository.findByIdForUser(userId, id);
  if (!existing) {
    return null;
  }

  const { name, normalizedName } = normalizeFolderName(input.name);

  try {
    const updated = await mediaFolderRepository.updateNameForUser(userId, id, {
      name,
      normalizedName,
    });

    return updated ? toItem(updated) : null;
  } catch (error) {
    if (error instanceof mediaFolderRepository.UniqueConstraintError) {
      throw new AppError('A folder with this name already exists', 409);
    }
    throw error;
  }
};

export const deleteFolder = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  // Policy: delete folder metadata and move its items to Unfiled.
  const deleted = await mediaFolderRepository.deleteForUserAndReassignDownloads(
    userId,
    id,
  );

  return deleted;
};


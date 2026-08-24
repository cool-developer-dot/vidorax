import type { Bookmark } from '@prisma/client';
import * as bookmarkRepository from '../repositories/bookmark.repository.js';
import type {
  BookmarkItem,
  CreateBookmarkInput,
  UpdateBookmarkInput,
} from '../types/user.types.js';
import { AppError } from '../utils/errors/index.js';
import {
  buildPaginatedResult,
  type ListSort,
  type PaginatedResult,
  type PaginationParams,
} from '../utils/pagination.js';
import {
  extractHostname,
  InvalidUrlError,
  normalizeUrl,
} from '../utils/url.js';

const toBookmarkItem = (bookmark: Bookmark): BookmarkItem => ({
  id: bookmark.id,
  url: bookmark.url,
  title: bookmark.title,
  hostname: bookmark.hostname,
  faviconUrl: bookmark.faviconUrl,
  createdAt: bookmark.createdAt,
});

const resolveUrl = (value: string): string => {
  try {
    return normalizeUrl(value);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      throw new AppError(error.message, 400);
    }

    throw error;
  }
};

export const createBookmark = async (
  userId: string,
  input: CreateBookmarkInput,
): Promise<BookmarkItem> => {
  const url = resolveUrl(input.url);

  try {
    const bookmark = await bookmarkRepository.create({
      url,
      title: input.title.trim(),
      hostname: extractHostname(url),
      faviconUrl:
        input.faviconUrl === undefined || input.faviconUrl === null
          ? input.faviconUrl ?? null
          : input.faviconUrl.trim(),
      user: {
        connect: { id: userId },
      },
    });

    return toBookmarkItem(bookmark);
  } catch (error) {
    if (error instanceof bookmarkRepository.UniqueConstraintError) {
      // Idempotent create — sync retries and multi-device saves return the existing row.
      const existing = await bookmarkRepository.findByUrlForUser(userId, url);

      if (existing) {
        return toBookmarkItem(existing);
      }

      throw new AppError('Bookmark already exists for this URL', 409);
    }

    throw error;
  }
};

export const listBookmarks = async (
  userId: string,
  pagination: PaginationParams,
  filters: { search?: string; sort?: ListSort } = {},
): Promise<PaginatedResult<BookmarkItem>> => {
  const { items, total } = await bookmarkRepository.listForUser(
    userId,
    pagination,
    {
      search: filters.search?.trim() || undefined,
      sort: filters.sort ?? 'newest',
    },
  );

  return buildPaginatedResult(items.map(toBookmarkItem), total, pagination);
};

export const updateBookmark = async (
  userId: string,
  id: string,
  input: UpdateBookmarkInput,
): Promise<BookmarkItem> => {
  const data: {
    url?: string;
    title?: string;
    hostname?: string;
    faviconUrl?: string | null;
  } = {};

  if (input.url !== undefined) {
    const url = resolveUrl(input.url);
    data.url = url;
    data.hostname = extractHostname(url);
  }

  if (input.title !== undefined) {
    data.title = input.title.trim();
  }

  if (input.faviconUrl !== undefined) {
    data.faviconUrl =
      input.faviconUrl === null ? null : input.faviconUrl.trim();
  }

  if (Object.keys(data).length === 0) {
    const existing = await bookmarkRepository.findByIdForUser(id, userId);

    if (!existing) {
      throw new AppError('Bookmark not found', 404);
    }

    return toBookmarkItem(existing);
  }

  try {
    const bookmark = await bookmarkRepository.updateForUser(id, userId, data);

    if (!bookmark) {
      throw new AppError('Bookmark not found', 404);
    }

    return toBookmarkItem(bookmark);
  } catch (error) {
    if (error instanceof bookmarkRepository.UniqueConstraintError) {
      throw new AppError('Bookmark already exists for this URL', 409);
    }

    throw error;
  }
};

export const deleteBookmark = async (
  userId: string,
  id: string,
): Promise<void> => {
  const deleted = await bookmarkRepository.deleteByIdForUser(id, userId);

  if (deleted === 0) {
    throw new AppError('Bookmark not found', 404);
  }
};

export const clearBookmarks = async (
  userId: string,
): Promise<{ deletedCount: number }> => {
  const deletedCount = await bookmarkRepository.deleteAllForUser(userId);
  return { deletedCount };
};

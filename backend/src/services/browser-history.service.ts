import type { BrowserHistory } from '@prisma/client';
import * as browserHistoryRepository from '../repositories/browser-history.repository.js';
import type {
  BrowserHistoryItem,
  CreateHistoryInput,
  RecentUrlItem,
} from '../types/user.types.js';
import { AppError } from '../utils/errors/index.js';
import {
  buildPaginatedResult,
  DEFAULT_RECENT_URLS_LIMIT,
  MAX_PAGE_LIMIT,
  type ListSort,
  type PaginatedResult,
  type PaginationParams,
} from '../utils/pagination.js';
import {
  extractHostname,
  InvalidUrlError,
  normalizeUrl,
} from '../utils/url.js';

const toHistoryItem = (entry: BrowserHistory): BrowserHistoryItem => ({
  id: entry.id,
  url: entry.url,
  title: entry.title,
  hostname: entry.hostname,
  visitedAt: entry.visitedAt,
  createdAt: entry.createdAt,
});

export const createHistory = async (
  userId: string,
  input: CreateHistoryInput,
): Promise<BrowserHistoryItem> => {
  let url: string;

  try {
    url = normalizeUrl(input.url);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      throw new AppError(error.message, 400);
    }

    throw error;
  }

  const title = input.title.trim();
  const hostname = extractHostname(url);
  const visitedAt =
    input.visitedAt instanceof Date && !Number.isNaN(input.visitedAt.getTime())
      ? input.visitedAt
      : new Date();

  const duplicate = await browserHistoryRepository.findRecentDuplicate(
    userId,
    url,
    visitedAt,
  );

  if (duplicate) {
    const updated = await browserHistoryRepository.updateVisit(
      duplicate.id,
      userId,
      {
        title,
        hostname,
        visitedAt,
      },
    );

    if (!updated) {
      throw new AppError('History entry not found', 404);
    }

    return toHistoryItem(updated);
  }

  const entry = await browserHistoryRepository.create({
    url,
    title,
    hostname,
    visitedAt,
    user: {
      connect: { id: userId },
    },
  });

  return toHistoryItem(entry);
};

export const listHistory = async (
  userId: string,
  pagination: PaginationParams,
  filters: { search?: string; hostname?: string; sort?: ListSort } = {},
): Promise<PaginatedResult<BrowserHistoryItem>> => {
  const { items, total } = await browserHistoryRepository.listForUser(
    userId,
    pagination,
    {
      search: filters.search?.trim() || undefined,
      hostname: filters.hostname?.trim().toLowerCase() || undefined,
      sort: filters.sort ?? 'newest',
    },
  );

  return buildPaginatedResult(items.map(toHistoryItem), total, pagination);
};

export const deleteHistoryEntry = async (
  userId: string,
  id: string,
): Promise<void> => {
  const deleted = await browserHistoryRepository.deleteByIdForUser(id, userId);

  if (deleted === 0) {
    throw new AppError('History entry not found', 404);
  }
};

export const clearHistory = async (
  userId: string,
): Promise<{ deletedCount: number }> => {
  const deletedCount = await browserHistoryRepository.deleteAllForUser(userId);
  return { deletedCount };
};

export const getRecentUrls = async (
  userId: string,
  limit = DEFAULT_RECENT_URLS_LIMIT,
): Promise<RecentUrlItem[]> => {
  const safeLimit = Math.min(
    Math.max(Math.trunc(limit) || DEFAULT_RECENT_URLS_LIMIT, 1),
    MAX_PAGE_LIMIT,
  );

  return browserHistoryRepository.findRecentUniqueUrls(userId, safeLimit);
};

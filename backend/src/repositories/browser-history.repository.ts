import type { BrowserHistory, Prisma } from '@prisma/client';
import { prisma } from '../database/index.js';
import {
  buildSortOrder,
  type ListSort,
  type PaginationParams,
} from '../utils/pagination.js';

export interface HistoryListFilters {
  search?: string;
  hostname?: string;
  sort?: ListSort;
}

/** Window used to coalesce rapid revisits of the same URL into one row. */
export const HISTORY_DEDUP_WINDOW_MS = 5 * 60 * 1000;

export const create = async (
  data: Prisma.BrowserHistoryCreateInput,
): Promise<BrowserHistory> => {
  return prisma.browserHistory.create({ data });
};

export const findByIdForUser = async (
  id: string,
  userId: string,
): Promise<BrowserHistory | null> => {
  return prisma.browserHistory.findFirst({
    where: { id, userId },
  });
};

/**
 * Most recent visit for a user+URL within the dedup window.
 * Used to update `visitedAt` instead of inserting duplicate refresh noise.
 */
export const findRecentDuplicate = async (
  userId: string,
  url: string,
  visitedAt: Date,
  windowMs = HISTORY_DEDUP_WINDOW_MS,
): Promise<BrowserHistory | null> => {
  const windowStart = new Date(visitedAt.getTime() - windowMs);

  return prisma.browserHistory.findFirst({
    where: {
      userId,
      url,
      visitedAt: { gte: windowStart },
    },
    orderBy: { visitedAt: 'desc' },
  });
};

export const updateVisit = async (
  id: string,
  userId: string,
  data: { title: string; hostname: string; visitedAt: Date },
): Promise<BrowserHistory | null> => {
  const result = await prisma.browserHistory.updateMany({
    where: { id, userId },
    data: {
      title: data.title,
      hostname: data.hostname,
      visitedAt: data.visitedAt,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return findByIdForUser(id, userId);
};

export const listForUser = async (
  userId: string,
  pagination: PaginationParams,
  filters: HistoryListFilters = {},
): Promise<{ items: BrowserHistory[]; total: number }> => {
  const where: Prisma.BrowserHistoryWhereInput = {
    userId,
    ...(filters.hostname ? { hostname: filters.hostname.toLowerCase() } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { url: { contains: filters.search, mode: 'insensitive' } },
            { hostname: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.browserHistory.findMany({
      where,
      orderBy: buildSortOrder(filters.sort, 'visitedAt'),
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.browserHistory.count({ where }),
  ]);

  return { items, total };
};

export const deleteByIdForUser = async (
  id: string,
  userId: string,
): Promise<number> => {
  const result = await prisma.browserHistory.deleteMany({
    where: { id, userId },
  });

  return result.count;
};

export const deleteAllForUser = async (userId: string): Promise<number> => {
  const result = await prisma.browserHistory.deleteMany({
    where: { userId },
  });

  return result.count;
};

export const findRecentUniqueUrls = async (
  userId: string,
  limit: number,
): Promise<
  Array<{
    url: string;
    title: string;
    hostname: string;
    visitedAt: Date;
  }>
> => {
  return prisma.$queryRaw`
    SELECT *
    FROM (
      SELECT DISTINCT ON (url)
        url,
        title,
        hostname,
        "visitedAt"
      FROM "BrowserHistory"
      WHERE "userId" = ${userId}::uuid
      ORDER BY url, "visitedAt" DESC
    ) AS recent
    ORDER BY "visitedAt" DESC
    LIMIT ${limit}
  `;
};

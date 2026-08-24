import { Prisma } from '@prisma/client';
import { prisma } from '../database/index.js';
import type { FavoriteListFilters } from '../types/favorite.types.js';
import {
  buildSortOrder,
  type PaginationParams,
} from '../utils/pagination.js';

const favoriteSelect = {
  id: true,
  userId: true,
  title: true,
  platform: true,
  sourceUrl: true,
  thumbnailUrl: true,
  createdAt: true,
} satisfies Prisma.FavoriteSelect;

export type FavoriteRecord = Prisma.FavoriteGetPayload<{
  select: typeof favoriteSelect;
}>;

export class UniqueConstraintError extends Error {
  constructor() {
    super('A unique database constraint was violated');
    this.name = 'UniqueConstraintError';
  }
}

export const create = async (
  data: Prisma.FavoriteCreateInput,
): Promise<FavoriteRecord> => {
  try {
    return await prisma.favorite.create({
      data,
      select: favoriteSelect,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new UniqueConstraintError();
    }

    throw error;
  }
};

export const listForUser = async (
  userId: string,
  pagination: PaginationParams,
  filters: FavoriteListFilters = {},
): Promise<{ items: FavoriteRecord[]; total: number }> => {
  const where: Prisma.FavoriteWhereInput = {
    userId,
    ...(filters.platform ? { platform: filters.platform } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { sourceUrl: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.favorite.findMany({
      where,
      select: favoriteSelect,
      orderBy: buildSortOrder(filters.sort),
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.favorite.count({ where }),
  ]);

  return { items, total };
};

export const findMatchingSourceUrls = async (
  userId: string,
  sourceUrls: string[],
): Promise<Set<string>> => {
  if (sourceUrls.length === 0) {
    return new Set();
  }

  const rows = await prisma.favorite.findMany({
    where: { userId, sourceUrl: { in: sourceUrls } },
    select: { sourceUrl: true },
  });

  return new Set(rows.map((row) => row.sourceUrl));
};

export const listSourceUrlsForUser = async (
  userId: string,
): Promise<string[]> => {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { sourceUrl: true },
  });
  return rows.map((row) => row.sourceUrl);
};

export const deleteForUser = async (
  id: string,
  userId: string,
): Promise<number> => {
  const result = await prisma.favorite.deleteMany({
    where: { id, userId },
  });

  return result.count;
};

export const deleteBySourceUrlForUser = async (
  userId: string,
  sourceUrl: string,
): Promise<number> => {
  const result = await prisma.favorite.deleteMany({
    where: { userId, sourceUrl },
  });

  return result.count;
};

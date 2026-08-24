import { Prisma, type Bookmark } from '@prisma/client';
import { prisma } from '../database/index.js';
import {
  buildSortOrder,
  type ListSort,
  type PaginationParams,
} from '../utils/pagination.js';

export class UniqueConstraintError extends Error {
  constructor() {
    super('A unique database constraint was violated');
    this.name = 'UniqueConstraintError';
  }
}

export interface BookmarkListFilters {
  search?: string;
  sort?: ListSort;
}

export const create = async (
  data: Prisma.BookmarkCreateInput,
): Promise<Bookmark> => {
  try {
    return await prisma.bookmark.create({ data });
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

export const findByIdForUser = async (
  id: string,
  userId: string,
): Promise<Bookmark | null> => {
  return prisma.bookmark.findFirst({
    where: { id, userId },
  });
};

export const findByUrlForUser = async (
  userId: string,
  url: string,
): Promise<Bookmark | null> => {
  return prisma.bookmark.findFirst({
    where: { userId, url },
  });
};

export const listForUser = async (
  userId: string,
  pagination: PaginationParams,
  filters: BookmarkListFilters = {},
): Promise<{ items: Bookmark[]; total: number }> => {
  const where: Prisma.BookmarkWhereInput = {
    userId,
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
    prisma.bookmark.findMany({
      where,
      orderBy: buildSortOrder(filters.sort),
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.bookmark.count({ where }),
  ]);

  return { items, total };
};

export const updateForUser = async (
  id: string,
  userId: string,
  data: {
    url?: string;
    title?: string;
    hostname?: string;
    faviconUrl?: string | null;
  },
): Promise<Bookmark | null> => {
  try {
    const result = await prisma.bookmark.updateMany({
      where: { id, userId },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return findByIdForUser(id, userId);
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

export const deleteByIdForUser = async (
  id: string,
  userId: string,
): Promise<number> => {
  const result = await prisma.bookmark.deleteMany({
    where: { id, userId },
  });

  return result.count;
};

export const deleteAllForUser = async (userId: string): Promise<number> => {
  const result = await prisma.bookmark.deleteMany({
    where: { userId },
  });

  return result.count;
};

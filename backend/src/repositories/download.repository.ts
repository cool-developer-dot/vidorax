import {
  Prisma,
  type DownloadHistory,
  type DownloadStatus,
} from '@prisma/client';
import { prisma } from '../database/index.js';
import type { DownloadSort } from '../types/download.types.js';
import type { MediaLibrarySort } from '../types/media-library.types.js';
import {
  buildSortOrder,
  type PaginationParams,
} from '../utils/pagination.js';

export interface DownloadListFilters {
  search?: string;
  status?: DownloadStatus;
  platform?: string;
  sort?: DownloadSort;
}

export interface DownloadUpdateGuard {
  expectedUpdatedAt?: Date;
  /** Conditional status guard — prevents stale clients from overriding newer states. */
  expectedStatus?: DownloadStatus;
}

export const create = async (
  data: Prisma.DownloadHistoryCreateInput,
): Promise<DownloadHistory> => {
  return prisma.downloadHistory.create({ data });
};

export const findByIdForUser = async (
  id: string,
  userId: string,
): Promise<DownloadHistory | null> => {
  return prisma.downloadHistory.findFirst({
    where: { id, userId },
  });
};

export const countForUser = async (userId: string): Promise<number> => {
  return prisma.downloadHistory.count({ where: { userId } });
};

export const listForUser = async (
  userId: string,
  pagination: PaginationParams,
  filters: DownloadListFilters = {},
): Promise<{ items: DownloadHistory[]; total: number }> => {
  const where: Prisma.DownloadHistoryWhereInput = {
    userId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.platform ? { platform: filters.platform } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { fileName: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.downloadHistory.findMany({
      where,
      orderBy: buildSortOrder(filters.sort),
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.downloadHistory.count({ where }),
  ]);

  return { items, total };
};

export const updateForUser = async (
  id: string,
  userId: string,
  data:
    | Prisma.DownloadHistoryUpdateManyMutationInput
    | Prisma.DownloadHistoryUncheckedUpdateManyInput,
  guard: DownloadUpdateGuard = {},
): Promise<DownloadHistory | null> => {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.downloadHistory.updateMany({
      where: {
        id,
        userId,
        ...(guard.expectedUpdatedAt
          ? { updatedAt: guard.expectedUpdatedAt }
          : {}),
        ...(guard.expectedStatus ? { status: guard.expectedStatus } : {}),
      },
      data: data as any,
    });

    if (result.count === 0) {
      return null;
    }

    return transaction.downloadHistory.findFirst({
      where: { id, userId },
    });
  });
};

export const deleteForUser = async (
  id: string,
  userId: string,
): Promise<number> => {
  const result = await prisma.downloadHistory.deleteMany({
    where: { id, userId },
  });

  return result.count;
};

function mediaLibraryOrderBy(
  sort: MediaLibrarySort = 'newest',
): Prisma.DownloadHistoryOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [
        { downloadedAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
        { id: 'asc' },
      ];
    case 'name_asc':
      return [{ title: 'asc' }, { id: 'asc' }];
    case 'name_desc':
      return [{ title: 'desc' }, { id: 'desc' }];
    case 'largest':
      return [{ fileSize: 'desc' }, { id: 'desc' }];
    case 'smallest':
      return [{ fileSize: 'asc' }, { id: 'asc' }];
    case 'newest':
    default:
      return [
        { downloadedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ];
  }
}

export const listCompletedLibraryForUser = async (
  userId: string,
  pagination: PaginationParams,
  filters: {
    sort?: MediaLibrarySort;
    sourceUrls?: string[];
    folderId?: string;
  } = {},
): Promise<{ items: DownloadHistory[]; total: number }> => {
  const where: Prisma.DownloadHistoryWhereInput = {
    userId,
    status: 'COMPLETED',
    ...(filters.sourceUrls ? { sourceUrl: { in: filters.sourceUrls } } : {}),
    ...(filters.folderId ? { folderId: filters.folderId } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.downloadHistory.findMany({
      where,
      orderBy: mediaLibraryOrderBy(filters.sort),
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.downloadHistory.count({ where }),
  ]);

  return { items, total };
};

export const findCompletedByIdForUser = async (
  id: string,
  userId: string,
): Promise<DownloadHistory | null> => {
  return prisma.downloadHistory.findFirst({
    where: { id, userId, status: 'COMPLETED' },
  });
};

export const findCompletedByFileNameForUser = async (
  userId: string,
  fileName: string,
  excludeId?: string,
): Promise<DownloadHistory | null> => {
  return prisma.downloadHistory.findFirst({
    where: {
      userId,
      status: 'COMPLETED',
      fileName,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
};

export const updateFolderIdForCompletedByIdForUser = async (
  id: string,
  userId: string,
  folderId: string | null,
): Promise<DownloadHistory | null> => {
  return updateForUser(
    id,
    userId,
    { folderId },
    { expectedStatus: 'COMPLETED' },
  );
};


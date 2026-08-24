import { Prisma } from '@prisma/client';
import { prisma } from '../database/index.js';
import type { PaginationParams } from '../utils/pagination.js';

const playbackSelect = {
  id: true,
  userId: true,
  mediaId: true,
  positionSeconds: true,
  durationSeconds: true,
  progressPercent: true,
  lastPlayedAt: true,
  completed: true,
  clientRevision: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlaybackHistorySelect;

export type PlaybackRecord = Prisma.PlaybackHistoryGetPayload<{
  select: typeof playbackSelect;
}>;

export const findByUserAndMedia = async (
  userId: string,
  mediaId: string,
): Promise<PlaybackRecord | null> => {
  return prisma.playbackHistory.findUnique({
    where: {
      userId_mediaId: { userId, mediaId },
    },
    select: playbackSelect,
  });
};

export type UpsertPlaybackData = {
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  lastPlayedAt: Date | null | undefined;
  completed: boolean;
  clientRevision: number;
};

/**
 * Idempotent upsert on (userId, mediaId).
 * lastPlayedAt: undefined → leave unchanged on update; null/Date → set.
 */
export const upsertForUserMedia = async (
  userId: string,
  mediaId: string,
  data: UpsertPlaybackData,
): Promise<PlaybackRecord> => {
  const createLastPlayedAt =
    data.lastPlayedAt === undefined ? null : data.lastPlayedAt;

  return prisma.playbackHistory.upsert({
    where: {
      userId_mediaId: { userId, mediaId },
    },
    create: {
      userId,
      mediaId,
      positionSeconds: data.positionSeconds,
      durationSeconds: data.durationSeconds,
      progressPercent: data.progressPercent,
      lastPlayedAt: createLastPlayedAt,
      completed: data.completed,
      clientRevision: data.clientRevision,
    },
    update: {
      positionSeconds: data.positionSeconds,
      durationSeconds: data.durationSeconds,
      progressPercent: data.progressPercent,
      completed: data.completed,
      clientRevision: data.clientRevision,
      ...(data.lastPlayedAt !== undefined
        ? { lastPlayedAt: data.lastPlayedAt }
        : {}),
    },
    select: playbackSelect,
  });
};

export const listHistoryForUser = async (
  userId: string,
  pagination: PaginationParams,
): Promise<{ items: PlaybackRecord[]; total: number }> => {
  const where: Prisma.PlaybackHistoryWhereInput = {
    userId,
    lastPlayedAt: { not: null },
  };

  const [items, total] = await prisma.$transaction([
    prisma.playbackHistory.findMany({
      where,
      select: playbackSelect,
      orderBy: { lastPlayedAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.playbackHistory.count({ where }),
  ]);

  return { items, total };
};

export const listContinueWatchingForUser = async (
  userId: string,
  pagination: PaginationParams,
): Promise<{ items: PlaybackRecord[]; total: number }> => {
  const where: Prisma.PlaybackHistoryWhereInput = {
    userId,
    completed: false,
    lastPlayedAt: { not: null },
  };

  const [items, total] = await prisma.$transaction([
    prisma.playbackHistory.findMany({
      where,
      select: playbackSelect,
      orderBy: { lastPlayedAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.playbackHistory.count({ where }),
  ]);

  return { items, total };
};

export const listRecentForUser = async (
  userId: string,
  limit: number,
): Promise<PlaybackRecord[]> => {
  return prisma.playbackHistory.findMany({
    where: {
      userId,
      lastPlayedAt: { not: null },
    },
    select: playbackSelect,
    orderBy: { lastPlayedAt: 'desc' },
    take: limit,
  });
};

export const deleteForUserMedia = async (
  userId: string,
  mediaId: string,
): Promise<number> => {
  const result = await prisma.playbackHistory.deleteMany({
    where: { userId, mediaId },
  });
  return result.count;
};

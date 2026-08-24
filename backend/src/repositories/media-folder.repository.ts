import { Prisma } from '@prisma/client';

import { prisma } from '../database/index.js';

export const folderSelect = {
  id: true,
  userId: true,
  name: true,
  normalizedName: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.MediaFolderSelect;

export type MediaFolderRecord = Prisma.MediaFolderGetPayload<{
  select: typeof folderSelect;
}>;

export class UniqueConstraintError extends Error {
  constructor() {
    super('A unique database constraint was violated');
    this.name = 'UniqueConstraintError';
  }
}

export const listForUser = async (
  userId: string,
): Promise<MediaFolderRecord[]> => {
  return prisma.mediaFolder.findMany({
    where: { userId },
    select: folderSelect,
    orderBy: { createdAt: 'desc' },
  });
};

export const findByIdForUser = async (
  userId: string,
  id: string,
): Promise<MediaFolderRecord | null> => {
  return prisma.mediaFolder.findFirst({
    where: { userId, id },
    select: folderSelect,
  });
};

export const findNamesByIdsForUser = async (
  userId: string,
  ids: string[],
): Promise<Array<{ id: string; name: string }>> => {
  if (ids.length === 0) {
    return [];
  }

  return prisma.mediaFolder.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, name: true },
  });
};

export const createForUser = async (
  userId: string,
  input: { name: string; normalizedName: string },
): Promise<MediaFolderRecord> => {
  try {
    return await prisma.mediaFolder.create({
      data: {
        name: input.name,
        normalizedName: input.normalizedName,
        user: { connect: { id: userId } },
      },
      select: folderSelect,
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

export const updateNameForUser = async (
  userId: string,
  id: string,
  input: { name: string; normalizedName: string },
): Promise<MediaFolderRecord | null> => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.mediaFolder.updateMany({
        where: { userId, id },
        data: { name: input.name, normalizedName: input.normalizedName },
      });

      if (updated.count === 0) {
        return null;
      }

      return tx.mediaFolder.findFirst({
        where: { userId, id },
        select: folderSelect,
      });
    });

    return result;
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

export const deleteForUserAndReassignDownloads = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.downloadHistory.updateMany({
      where: { userId, folderId: id },
      data: { folderId: null },
    });

    const deleted = await tx.mediaFolder.deleteMany({
      where: { userId, id },
    });

    return deleted.count > 0;
  });

  return result;
};


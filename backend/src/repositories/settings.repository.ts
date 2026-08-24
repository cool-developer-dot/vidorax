import { Prisma, type UserSettings } from '@prisma/client';
import { prisma } from '../database/index.js';

export const findByUserId = async (
  userId: string,
): Promise<UserSettings | null> => {
  return prisma.userSettings.findUnique({
    where: { userId },
  });
};

export const createDefault = async (userId: string): Promise<UserSettings> => {
  try {
    return await prisma.userSettings.create({
      data: { userId },
    });
  } catch (error) {
    // Concurrent first-access race: another request created the row first.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await findByUserId(userId);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
};

export const updateByUserId = async (
  userId: string,
  data: Prisma.UserSettingsUpdateInput,
): Promise<UserSettings> => {
  return prisma.userSettings.update({
    where: { userId },
    data,
  });
};

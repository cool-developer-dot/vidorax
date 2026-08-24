import type { Prisma, User } from '@prisma/client';
import { prisma } from '../database/index.js';

export const findById = async (id: string): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { id },
  });
};

export const update = async (
  id: string,
  data: Prisma.UserUpdateInput,
): Promise<User> => {
  return prisma.user.update({
    where: { id },
    data,
  });
};

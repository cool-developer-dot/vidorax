import { Prisma, type User } from '@prisma/client';
import { prisma } from '../database/index.js';

export class UniqueConstraintError extends Error {
  constructor() {
    super('A unique database constraint was violated');
    this.name = 'UniqueConstraintError';
  }
}

export const findByEmail = async (email: string): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { email },
  });
};

export const findById = async (id: string): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { id },
  });
};

export const create = async (data: Prisma.UserCreateInput): Promise<User> => {
  try {
    return await prisma.user.create({ data });
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

export const update = async (
  id: string,
  data: Prisma.UserUpdateInput,
): Promise<User> => {
  return prisma.user.update({
    where: { id },
    data,
  });
};

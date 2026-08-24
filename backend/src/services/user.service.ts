import type { User } from '@prisma/client';
import * as userRepository from '../repositories/user.repository.js';
import type {
  UpdateProfileInput,
  UserProfile,
} from '../types/user.types.js';
import { AppError } from '../utils/errors/index.js';

const toUserProfile = (user: User): UserProfile => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  avatarUrl: user.avatarUrl,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getProfile = async (userId: string): Promise<UserProfile> => {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return toUserProfile(user);
};

export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> => {
  const existing = await userRepository.findById(userId);

  if (!existing) {
    throw new AppError('User not found', 404);
  }

  const data: {
    name?: string;
  } = {};

  if (input.name !== undefined) {
    data.name = input.name.trim();
  }

  if (Object.keys(data).length === 0) {
    return toUserProfile(existing);
  }

  const user = await userRepository.update(userId, data);
  return toUserProfile(user);
};

/**
 * Avatar pipeline only — never expose arbitrary URL writes on PATCH /users/me.
 */
export const setAvatarUrl = async (
  userId: string,
  avatarUrl: string | null,
): Promise<UserProfile> => {
  const existing = await userRepository.findById(userId);

  if (!existing) {
    throw new AppError('User not found', 404);
  }

  const user = await userRepository.update(userId, { avatarUrl });
  return toUserProfile(user);
};

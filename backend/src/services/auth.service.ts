import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  verifyRefreshToken,
} from '../security/index.js';
import type {
  AuthResponse,
  LoginRequest,
  PublicUser,
  RefreshRequest,
  RefreshResponse,
  RegisterRequest,
  User,
} from '../types/auth.types.js';
import * as authRepository from '../repositories/auth.repository.js';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  createdAt: user.createdAt,
});

const buildAuthResponse = (user: User): AuthResponse => {
  const tokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return {
    user: toPublicUser(user),
    accessToken: generateAccessToken(tokenPayload),
    refreshToken: generateRefreshToken(tokenPayload),
  };
};

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
  const user = await authRepository.findByEmail(
    normalizeEmail(credentials.email),
  );

  if (!user) {
    throw new AuthServiceError('Invalid email or password', 401);
  }

  const isValidPassword = await comparePassword(
    credentials.password,
    user.passwordHash,
  );

  if (!isValidPassword) {
    throw new AuthServiceError('Invalid email or password', 401);
  }

  return buildAuthResponse(user);
};

export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  const email = normalizeEmail(data.email);
  const existingUser = await authRepository.findByEmail(email);

  if (existingUser) {
    throw new AuthServiceError('Email is already registered', 409);
  }

  const passwordHash = await hashPassword(data.password);

  try {
    const user = await authRepository.create({
      email,
      name: data.name.trim(),
      passwordHash,
      settings: {
        create: {},
      },
    });

    return buildAuthResponse(user);
  } catch (error) {
    if (error instanceof authRepository.UniqueConstraintError) {
      throw new AuthServiceError('Email is already registered', 409);
    }

    throw error;
  }
};

export const refresh = async (
  payload: RefreshRequest,
): Promise<RefreshResponse> => {
  let tokenPayload;

  try {
    tokenPayload = verifyRefreshToken(payload.refreshToken);
  } catch {
    throw new AuthServiceError('Invalid or expired refresh token', 401);
  }

  const user = await authRepository.findById(tokenPayload.sub);

  if (!user) {
    throw new AuthServiceError('Invalid or expired refresh token', 401);
  }

  const nextPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return {
    accessToken: generateAccessToken(nextPayload),
    refreshToken: generateRefreshToken(nextPayload),
  };
};

export const logout = async (): Promise<{ message: string }> => {
  return { message: 'Logged out successfully' };
};

export const me = async (userId: string): Promise<PublicUser> => {
  const user = await authRepository.findById(userId);

  if (!user) {
    throw new AuthServiceError('User not found', 404);
  }

  return toPublicUser(user);
};

import type { Request } from 'express';
import type { Role, User } from '@prisma/client';

export type { User };

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

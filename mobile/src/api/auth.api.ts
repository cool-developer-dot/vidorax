import { post, get } from './request';
import type {
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  User,
} from './types';

export type RefreshTokensRequest = {
  refreshToken: string;
};

export type RefreshTokensResponse = {
  accessToken: string;
  refreshToken: string;
};

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  return post<LoginResponse, LoginRequest>('/auth/login', payload);
}

export async function register(
  payload: RegisterRequest,
): Promise<RegisterResponse> {
  return post<RegisterResponse, RegisterRequest>('/auth/register', payload);
}

export async function logout(): Promise<LogoutResponse> {
  return post<LogoutResponse>('/auth/logout');
}

export async function me(): Promise<User> {
  const response = await get<MeResponse>('/auth/me');
  return response.user;
}

/**
 * Exchanges a refresh token for a new access/refresh pair via POST /auth/refresh.
 */
export async function refreshTokens(
  payload: RefreshTokensRequest,
): Promise<RefreshTokensResponse> {
  return post<RefreshTokensResponse, RefreshTokensRequest>(
    '/auth/refresh',
    payload,
    { _skipAuthRefresh: true } as never,
  );
}

export const authApi = {
  login,
  register,
  logout,
  me,
  refreshTokens,
} as const;

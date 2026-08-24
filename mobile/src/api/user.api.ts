import type { AxiosRequestConfig } from 'axios';

import { get, patch } from './request';
import type {
  Profile,
  ProfileResponse,
  UpdateProfileRequest,
} from './types';

export async function getProfile(
  config?: AxiosRequestConfig,
): Promise<Profile> {
  const response = await get<ProfileResponse>('/users/me', config);
  return response.user;
}

export async function updateProfile(
  payload: UpdateProfileRequest,
  config?: AxiosRequestConfig,
): Promise<Profile> {
  const response = await patch<ProfileResponse, UpdateProfileRequest>(
    '/users/me',
    payload,
    config,
  );
  return response.user;
}

export const userApi = {
  getProfile,
  updateProfile,
} as const;

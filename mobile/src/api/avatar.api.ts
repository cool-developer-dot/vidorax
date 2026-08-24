import type { AxiosRequestConfig } from 'axios';

import { del, post, put } from './request';
import type {
  AvatarUploadTicket,
  AvatarUploadTicketResponse,
  CommitAvatarRequest,
  Profile,
  ProfileResponse,
} from './types';

/** Reserves an object path and returns a signed URL to PUT the JPEG bytes to. */
export async function createAvatarUploadTicket(
  config?: AxiosRequestConfig,
): Promise<AvatarUploadTicket> {
  const response = await post<AvatarUploadTicketResponse>(
    '/users/me/avatar/upload-url',
    undefined,
    config,
  );
  return response.upload;
}

/** Persists an uploaded object as the avatar and returns the updated profile. */
export async function commitAvatar(
  path: string,
  config?: AxiosRequestConfig,
): Promise<Profile> {
  const response = await put<ProfileResponse, CommitAvatarRequest>(
    '/users/me/avatar',
    { path },
    config,
  );
  return response.user;
}

export async function deleteAvatar(
  config?: AxiosRequestConfig,
): Promise<Profile> {
  const response = await del<ProfileResponse>('/users/me/avatar', config);
  return response.user;
}

export const avatarApi = {
  createAvatarUploadTicket,
  commitAvatar,
  deleteAvatar,
} as const;

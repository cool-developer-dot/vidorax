import { isCancel } from 'axios';
import { File, UploadType } from 'expo-file-system';

import {
  commitAvatar,
  createAvatarUploadTicket,
  deleteAvatar,
} from '@/api/avatar.api';
import { createApiError } from '@/api/errors';
import type { AvatarUploadTicket, Profile } from '@/api/types';
import { hydrateUserFromProfile } from '@/services/auth/profile.service';

export type AvatarUploadPhase = 'preparing' | 'uploading' | 'saving';

export type AvatarUploadProgress = {
  phase: AvatarUploadPhase;
  /** Overall completion across all three phases, 0–1. */
  ratio: number;
  bytesSent: number;
  totalBytes: number;
};

export type UploadAvatarOptions = {
  fileUri: string;
  byteSize: number;
  onProgress?: (progress: AvatarUploadProgress) => void;
  signal?: AbortSignal;
};

/** Objects are immutable (timestamped names), so they can cache indefinitely. */
const STORAGE_CACHE_CONTROL = 'max-age=31536000';

// Phase weights keep the progress bar monotonic across ticket → upload → commit.
const UPLOAD_PHASE_START = 0.05;
const UPLOAD_PHASE_END = 0.9;

export function isAbortError(error: unknown): boolean {
  if (isCancel(error)) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.name === 'AbortError' || /abort|cancel/i.test(error.message))
  );
}

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new DOMException('Avatar upload aborted', 'AbortError');
  }
};

const uploadToSignedUrl = async (
  ticket: AvatarUploadTicket,
  options: UploadAvatarOptions,
): Promise<void> => {
  const file = new File(options.fileUri);

  if (!file.exists) {
    throw createApiError({
      code: 'UNKNOWN',
      status: null,
      message: 'The selected photo is no longer available on this device.',
    });
  }

  if (file.size > ticket.maxBytes) {
    throw createApiError({
      code: 'VALIDATION_ERROR',
      status: 413,
      message: 'That photo is too large. Please choose a smaller image.',
    });
  }

  const task = file.createUploadTask(ticket.uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    mimeType: ticket.contentType,
    headers: {
      'content-type': ticket.contentType,
      'cache-control': STORAGE_CACHE_CONTROL,
      'x-upsert': 'true',
    },
    signal: options.signal,
    onProgress: ({ bytesSent, totalBytes }) => {
      const fraction = totalBytes > 0 ? bytesSent / totalBytes : 0;
      options.onProgress?.({
        phase: 'uploading',
        ratio:
          UPLOAD_PHASE_START +
          fraction * (UPLOAD_PHASE_END - UPLOAD_PHASE_START),
        bytesSent,
        totalBytes,
      });
    },
  });

  const result = await task.uploadAsync();

  // `uploadAsync` resolves for non-2xx responses too, so the status is checked here.
  if (result.status < 200 || result.status >= 300) {
    throw createApiError({
      code: result.status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN',
      status: result.status,
      message: 'Uploading your photo failed. Please try again.',
    });
  }
};

/**
 * Uploads a prepared JPEG straight to Supabase Storage using a server-issued
 * signed URL, then asks the API to persist it. Bytes never transit our API and
 * the storage credentials never reach the device.
 */
export async function uploadAvatar(
  options: UploadAvatarOptions,
): Promise<Profile> {
  const { onProgress, signal } = options;

  throwIfAborted(signal);
  onProgress?.({
    phase: 'preparing',
    ratio: 0,
    bytesSent: 0,
    totalBytes: options.byteSize,
  });

  const ticket = await createAvatarUploadTicket({ signal });

  throwIfAborted(signal);
  onProgress?.({
    phase: 'uploading',
    ratio: UPLOAD_PHASE_START,
    bytesSent: 0,
    totalBytes: options.byteSize,
  });

  await uploadToSignedUrl(ticket, options);

  throwIfAborted(signal);
  onProgress?.({
    phase: 'saving',
    ratio: UPLOAD_PHASE_END,
    bytesSent: options.byteSize,
    totalBytes: options.byteSize,
  });

  const profile = await commitAvatar(ticket.path, { signal });

  hydrateUserFromProfile(profile);

  onProgress?.({
    phase: 'saving',
    ratio: 1,
    bytesSent: options.byteSize,
    totalBytes: options.byteSize,
  });

  return profile;
}

export async function removeAvatar(signal?: AbortSignal): Promise<Profile> {
  const profile = await deleteAvatar({ signal });
  hydrateUserFromProfile(profile);
  return profile;
}

export const avatarService = {
  uploadAvatar,
  removeAvatar,
  isAbortError,
} as const;

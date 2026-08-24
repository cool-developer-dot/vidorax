import { env } from '../config/env.js';
import { getAvatarBucket, getStorageClient } from '../storage/supabase-storage.client.js';
import * as userService from './user.service.js';
import type { AvatarUploadTicket } from '../types/avatar.types.js';
import type { UserProfile } from '../types/user.types.js';
import { AppError } from '../utils/errors/index.js';

const AVATAR_CONTENT_TYPE = 'image/jpeg';
const AVATAR_EXTENSION = '.jpg';
const MAX_LISTED_OBJECTS = 100;

let bucketReady: Promise<void> | null = null;

const ensureBucket = async (): Promise<void> => {
  if (!bucketReady) {
    bucketReady = (async () => {
      const storage = getStorageClient().storage;
      const bucketOptions = {
        public: true,
        fileSizeLimit: env.avatarMaxBytes,
        allowedMimeTypes: [AVATAR_CONTENT_TYPE],
      };
      const { data } = await storage.getBucket(env.supabaseAvatarBucket);

      if (data) {
        // A hand-created private bucket would make every public avatar URL 400.
        if (!data.public) {
          await storage.updateBucket(env.supabaseAvatarBucket, bucketOptions);
        }
        return;
      }

      const { error } = await storage.createBucket(
        env.supabaseAvatarBucket,
        bucketOptions,
      );

      // A concurrent request may have created it first; that is not a failure.
      if (error && !/already exists/i.test(error.message)) {
        throw new AppError(`Unable to prepare avatar storage: ${error.message}`, 502);
      }
    })().catch((error: unknown) => {
      bucketReady = null;
      throw error;
    });
  }

  return bucketReady;
};

/**
 * Objects are named `{userId}-{timestamp}.jpg` at the bucket root, so ownership
 * is provable from the path alone and traversal segments cannot pass.
 */
const isOwnedAvatarPath = (userId: string, path: string): boolean => {
  if (!path.endsWith(AVATAR_EXTENSION)) {
    return false;
  }

  const base = path.slice(0, -AVATAR_EXTENSION.length);
  const prefix = `${userId}-`;

  if (!base.startsWith(prefix)) {
    return false;
  }

  return /^\d{10,17}$/.test(base.slice(prefix.length));
};

const buildAvatarPath = (userId: string): string =>
  `${userId}-${Date.now()}${AVATAR_EXTENSION}`;

const getPublicUrl = (path: string): string =>
  getAvatarBucket().getPublicUrl(path).data.publicUrl;

const listOwnedObjects = async (userId: string): Promise<string[]> => {
  const { data, error } = await getAvatarBucket().list('', {
    limit: MAX_LISTED_OBJECTS,
    search: userId,
  });

  if (error || !data) {
    return [];
  }

  return data
    .map((object) => object.name)
    .filter((name) => isOwnedAvatarPath(userId, name));
};

/**
 * Best-effort cleanup so replaced avatars never accumulate as orphans. Runs
 * after the profile row is already updated, so a failure here must not fail
 * the request.
 */
const pruneOwnedObjects = async (
  userId: string,
  keepPath?: string,
): Promise<void> => {
  try {
    const stale = (await listOwnedObjects(userId)).filter(
      (name) => name !== keepPath,
    );

    if (stale.length === 0) {
      return;
    }

    await getAvatarBucket().remove(stale);
  } catch (error) {
    console.error('Failed to prune stale avatars', { userId, error });
  }
};

export const createUploadTicket = async (
  userId: string,
): Promise<AvatarUploadTicket> => {
  await ensureBucket();

  const path = buildAvatarPath(userId);
  const { data, error } = await getAvatarBucket().createSignedUploadUrl(path, {
    upsert: true,
  });

  if (error || !data) {
    throw new AppError(
      `Unable to create avatar upload URL: ${error?.message ?? 'unknown error'}`,
      502,
    );
  }

  return {
    path: data.path,
    uploadUrl: data.signedUrl,
    token: data.token,
    publicUrl: getPublicUrl(data.path),
    contentType: AVATAR_CONTENT_TYPE,
    maxBytes: env.avatarMaxBytes,
  };
};

/**
 * Persists an already-uploaded object as the user's avatar. The public URL is
 * derived server-side, so a client can never point `avatarUrl` at another
 * user's object through this endpoint.
 */
export const commitUpload = async (
  userId: string,
  path: string,
): Promise<UserProfile> => {
  if (!isOwnedAvatarPath(userId, path)) {
    throw new AppError('Avatar path does not belong to the current user', 403);
  }

  const { data, error } = await getAvatarBucket().list('', {
    limit: 1,
    search: path,
  });

  if (error) {
    throw new AppError(`Unable to verify uploaded avatar: ${error.message}`, 502);
  }

  const uploaded = data?.find((object) => object.name === path);

  if (!uploaded) {
    throw new AppError('Uploaded avatar was not found in storage', 404);
  }

  const size = uploaded.metadata?.size as number | undefined;

  if (typeof size === 'number' && size > env.avatarMaxBytes) {
    await getAvatarBucket().remove([path]);
    throw new AppError('Uploaded avatar exceeds the maximum allowed size', 413);
  }

  const profile = await userService.setAvatarUrl(userId, getPublicUrl(path));

  await pruneOwnedObjects(userId, path);

  return profile;
};

export const removeAvatar = async (userId: string): Promise<UserProfile> => {
  const profile = await userService.setAvatarUrl(userId, null);

  await pruneOwnedObjects(userId);

  return profile;
};

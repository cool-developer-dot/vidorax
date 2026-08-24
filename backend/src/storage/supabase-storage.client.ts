import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isAvatarStorageConfigured } from '../config/env.js';
import { AppError } from '../utils/errors/index.js';

let client: SupabaseClient | null = null;

/**
 * Service-role client. It bypasses RLS, so it must never leave the server and
 * every caller is responsible for scoping operations to the acting user.
 */
export const getStorageClient = (): SupabaseClient => {
  if (!isAvatarStorageConfigured()) {
    throw new AppError('Avatar storage is not configured', 503);
  }

  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return client;
};

type AvatarBucket = ReturnType<SupabaseClient['storage']['from']>;

export const getAvatarBucket = (): AvatarBucket =>
  getStorageClient().storage.from(env.supabaseAvatarBucket);

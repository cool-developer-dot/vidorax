import * as SecureStore from 'expo-secure-store';

import type { Profile } from '@/api/types';
import { storageKeys } from '@/constants';

function warn(action: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[profile-snapshot] ${action} failed`, error);
  }
}

/**
 * Persists a slim authenticated profile for offline session restore.
 * Cleared on logout. Never logs profile payloads.
 */
export async function saveProfileSnapshot(profile: Profile): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      storageKeys.profileSnapshot,
      JSON.stringify(profile),
    );
  } catch (error) {
    warn('save', error);
  }
}

export async function loadProfileSnapshot(): Promise<Profile | null> {
  try {
    const raw = await SecureStore.getItemAsync(storageKeys.profileSnapshot);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Profile;
    if (
      typeof parsed?.id !== 'string' ||
      typeof parsed?.email !== 'string' ||
      typeof parsed?.name !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    warn('load', error);
    return null;
  }
}

export async function clearProfileSnapshot(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(storageKeys.profileSnapshot);
  } catch (error) {
    warn('clear', error);
  }
}

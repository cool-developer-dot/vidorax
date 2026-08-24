import { isCancel } from 'axios';

import { getProfile, updateProfile as updateProfileRequest } from '@/api/user.api';
import type { Profile, UpdateProfileRequest } from '@/api/types';
import { useUserStore } from '@/store';

import { clearProfileCache } from './profile-memory-cache';

let profileInFlight: Promise<Profile> | null = null;
let updateAbortController: AbortController | null = null;
/** Bumped on logout so in-flight profile responses cannot hydrate the next session. */
let profileSessionEpoch = 0;

export function hydrateUserFromProfile(profile: Profile): void {
  useUserStore.getState().updateProfile({
    id: profile.id,
    email: profile.email,
    displayName: profile.name,
  });
}

export function hydrateUserFromAuthUser(user: {
  id: string;
  email: string;
  name: string;
}): void {
  useUserStore.getState().updateProfile({
    id: user.id,
    email: user.email,
    displayName: user.name,
  });
}

export function clearUserSession(): void {
  profileSessionEpoch += 1;
  profileInFlight = null;

  if (updateAbortController) {
    updateAbortController.abort();
    updateAbortController = null;
  }

  clearProfileCache();
  useUserStore.getState().logout();
}

/**
 * Loads the authenticated profile once (deduped).
 */
export async function loadProfile(): Promise<Profile> {
  if (profileInFlight) {
    return profileInFlight;
  }

  const epoch = profileSessionEpoch;

  profileInFlight = getProfile()
    .then((profile) => {
      if (epoch !== profileSessionEpoch) {
        const error = new Error('Profile load superseded by session clear');
        error.name = 'SessionSupersededError';
        throw error;
      }
      hydrateUserFromProfile(profile);
      return profile;
    })
    .finally(() => {
      profileInFlight = null;
    });

  return profileInFlight;
}

/**
 * Updates the authenticated profile.
 * Cancels any in-flight PATCH so rapid saves do not race.
 */
export async function updateProfile(
  payload: UpdateProfileRequest,
): Promise<Profile> {
  if (updateAbortController) {
    updateAbortController.abort();
  }

  const abortController = new AbortController();
  updateAbortController = abortController;
  const epoch = profileSessionEpoch;

  try {
    const profile = await updateProfileRequest(payload, {
      signal: abortController.signal,
    });

    if (epoch !== profileSessionEpoch) {
      const error = new Error('Profile update superseded by session clear');
      error.name = 'SessionSupersededError';
      throw error;
    }

    hydrateUserFromProfile(profile);
    return profile;
  } catch (error) {
    if (isCancel(error)) {
      throw error;
    }
    throw error;
  } finally {
    if (updateAbortController === abortController) {
      updateAbortController = null;
    }
  }
}

export const profileService = {
  loadProfile,
  updateProfile,
  hydrateUserFromProfile,
  hydrateUserFromAuthUser,
  clearUserSession,
} as const;

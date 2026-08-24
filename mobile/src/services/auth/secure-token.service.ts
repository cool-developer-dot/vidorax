import * as SecureStore from 'expo-secure-store';

import { storageKeys } from '@/constants';

export type SecureTokens = {
  accessToken: string;
  refreshToken: string;
};

function warn(action: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[secure-token] ${action} failed`, error);
  }
}

/**
 * Dedicated SecureStore persistence for JWTs.
 * Never logs token values.
 */
export async function saveTokens(tokens: SecureTokens): Promise<void> {
  try {
    await SecureStore.setItemAsync(storageKeys.authToken, tokens.accessToken);
    try {
      await SecureStore.setItemAsync(
        storageKeys.refreshToken,
        tokens.refreshToken,
      );
    } catch (refreshError) {
      // Avoid leaving an orphaned access token without its refresh pair.
      try {
        await SecureStore.deleteItemAsync(storageKeys.authToken);
      } catch {
        // Best-effort rollback.
      }
      throw refreshError;
    }
  } catch (error) {
    warn('saveTokens', error);
    throw error;
  }
}

export async function loadTokens(): Promise<SecureTokens | null> {
  try {
    const accessToken = await SecureStore.getItemAsync(storageKeys.authToken);
    const refreshToken = await SecureStore.getItemAsync(storageKeys.refreshToken);

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  } catch (error) {
    warn('loadTokens', error);
    return null;
  }
}

export async function deleteTokens(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(storageKeys.authToken);
  } catch (error) {
    warn('deleteAccessToken', error);
  }

  try {
    await SecureStore.deleteItemAsync(storageKeys.refreshToken);
  } catch (error) {
    warn('deleteRefreshToken', error);
  }
}

export const secureTokenService = {
  saveTokens,
  loadTokens,
  deleteTokens,
} as const;

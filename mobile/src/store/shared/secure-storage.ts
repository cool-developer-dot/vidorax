import * as SecureStore from 'expo-secure-store';
import { createJSONStorage } from 'zustand/middleware';

import type { StateStorage } from 'zustand/middleware';

function warn(action: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[secure-storage] ${action} failed`, error);
  }
}

export function createSecureStorageAdapter(): StateStorage {
  return {
    getItem: async (name) => {
      try {
        return (await SecureStore.getItemAsync(name)) ?? null;
      } catch (error) {
        warn('getItem', error);
        return null;
      }
    },
    setItem: async (name, value) => {
      try {
        await SecureStore.setItemAsync(name, value);
      } catch (error) {
        warn('setItem', error);
      }
    },
    removeItem: async (name) => {
      try {
        await SecureStore.deleteItemAsync(name);
      } catch (error) {
        warn('removeItem', error);
      }
    },
  };
}

export function createSecurePersistStorage() {
  return createJSONStorage(() => createSecureStorageAdapter());
}

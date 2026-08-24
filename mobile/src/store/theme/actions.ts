import type { StoreApi } from 'zustand';

import { setThemeMode } from '@/storage/mmkv';
import { applyNativeColorScheme } from '@/theme/apply-native-color-scheme';

import { initialThemeState } from './state';
import type { ThemeActions, ThemePreference, ThemeStore } from './types';

const themeCycle: ThemePreference[] = ['light', 'dark', 'system'];

function commitTheme(mode: ThemePreference, set: StoreApi<ThemeStore>['setState']): void {
  setThemeMode(mode);
  applyNativeColorScheme(mode);
  set({ themeMode: mode });
}

export function createThemeActions(
  set: StoreApi<ThemeStore>['setState'],
  get: StoreApi<ThemeStore>['getState'],
): ThemeActions {
  return {
    setTheme: (mode) => {
      commitTheme(mode, set);
    },
    toggleTheme: () => {
      const currentIndex = themeCycle.indexOf(get().themeMode);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % themeCycle.length;
      commitTheme(themeCycle[nextIndex], set);
    },
    reset: () => {
      commitTheme(initialThemeState.themeMode, set);
    },
  };
}

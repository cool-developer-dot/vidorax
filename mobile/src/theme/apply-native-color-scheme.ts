import { Appearance } from 'react-native';

import type { ThemePreference } from '@/store/theme/types';

/**
 * Applies the user's theme preference to React Native's Appearance API.
 *
 * For `system`, we intentionally do not call `setColorScheme` — Android Expo Go
 * builds have segfaulted on `'unspecified'` / null restore paths. Forced Light /
 * Dark still use Appearance; `useColorScheme` resolves `system` from the OS.
 */
export function applyNativeColorScheme(mode: ThemePreference): void {
  try {
    if (typeof Appearance.setColorScheme !== 'function') {
      return;
    }

    if (mode === 'system') {
      return;
    }

    Appearance.setColorScheme(mode);
  } catch {
    // Never let theme application crash the process (Expo Go / older RN).
  }
}

import { mmkvKeys } from '@/storage/constants';
import type { ThemePreference } from '@/store/theme/types';

import { getMmkvInstance } from './instance';

const VALID_THEME_MODES: ThemePreference[] = ['light', 'dark', 'system'];

export function getThemeMode(defaultValue: ThemePreference = 'system'): ThemePreference {
  const value = getMmkvInstance()?.getString(mmkvKeys.themeMode);

  if (value && VALID_THEME_MODES.includes(value as ThemePreference)) {
    return value as ThemePreference;
  }

  return defaultValue;
}

export function setThemeMode(mode: ThemePreference): void {
  getMmkvInstance()?.set(mmkvKeys.themeMode, mode);
}

export function clearThemeMode(): void {
  getMmkvInstance()?.remove(mmkvKeys.themeMode);
}

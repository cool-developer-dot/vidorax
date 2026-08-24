import { useColorScheme as useSystemColorScheme } from 'react-native';

import { selectThemeMode, useThemeStore } from '@/store/theme';

export type ResolvedColorScheme = 'light' | 'dark';

/**
 * Resolves the active color scheme from themeStore + system Appearance.
 * Prevents incorrect light/dark flashes when preference is Light/Dark while
 * the OS scheme differs.
 */
export function useColorScheme(): ResolvedColorScheme {
  const systemScheme = useSystemColorScheme();
  const themeMode = useThemeStore(selectThemeMode);

  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  if (systemScheme === 'dark') {
    return 'dark';
  }

  return 'light';
}

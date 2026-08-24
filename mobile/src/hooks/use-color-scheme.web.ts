import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { selectThemeMode, useThemeStore } from '@/store/theme';

type ResolvedColorScheme = 'light' | 'dark';

/**
 * Web color scheme — waits for client hydration, then resolves themeStore
 * preference (light / dark / system) against the browser scheme.
 */
export function useColorScheme(): ResolvedColorScheme {
  const [hasHydrated, setHasHydrated] = useState(false);
  const systemScheme = useRNColorScheme();
  const themeMode = useThemeStore(selectThemeMode);

  useEffect(() => {
    // Client-only hydration gate for SSR-safe initial paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydrate flip
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return 'light';
  }

  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  if (systemScheme === 'dark') {
    return 'dark';
  }

  return 'light';
}

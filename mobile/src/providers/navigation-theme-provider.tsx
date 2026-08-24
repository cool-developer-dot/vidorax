import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { type PropsWithChildren, useMemo } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { themes } from '@/theme';

function createNavigationTheme(mode: 'light' | 'dark') {
  const palette = themes[mode].colors;
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.card,
      text: palette.textPrimary,
      border: palette.border,
      notification: palette.accent,
    },
  };
}

export function NavigationThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const navigationTheme = useMemo(() => createNavigationTheme(mode), [mode]);

  return <ThemeProvider value={navigationTheme}>{children}</ThemeProvider>;
}

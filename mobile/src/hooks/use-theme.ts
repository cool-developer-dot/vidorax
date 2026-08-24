import { themes, type Theme, type ThemeMode } from '@/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme;

  return themes[mode];
}

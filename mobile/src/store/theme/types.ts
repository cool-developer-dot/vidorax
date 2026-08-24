export type ThemePreference = 'light' | 'dark' | 'system';

export interface ThemeState {
  themeMode: ThemePreference;
}

export interface ThemeActions {
  setTheme: (mode: ThemePreference) => void;
  toggleTheme: () => void;
  reset: () => void;
}

export type ThemeStore = ThemeState & ThemeActions;

import type { Theme } from '@/theme';

import type { TabScreenOptions } from '../types/navigation';

export const tabItems = {
  home: {
    routeName: 'index',
    title: 'Home',
    icon: 'home-outline',
    iconFocused: 'home',
    accessibilityLabel: 'Home tab',
  },
  browser: {
    routeName: 'browser',
    title: 'Browser',
    icon: 'web',
    iconFocused: 'web',
    accessibilityLabel: 'Browser tab',
  },
  downloads: {
    routeName: 'downloads',
    title: 'Downloads',
    icon: 'download-outline',
    iconFocused: 'download',
    accessibilityLabel: 'Downloads tab',
  },
  library: {
    routeName: 'library',
    title: 'Library',
    icon: 'book-open-variant',
    iconFocused: 'book-open-variant',
    accessibilityLabel: 'Library tab',
  },
  settings: {
    routeName: 'settings',
    title: 'Settings',
    icon: 'cog-outline',
    iconFocused: 'cog',
    accessibilityLabel: 'Settings tab',
  },
} as const satisfies Record<
  string,
  {
    routeName: string;
    title: string;
    icon: string;
    iconFocused: string;
    accessibilityLabel: string;
  }
>;

export type TabItemKey = keyof typeof tabItems;

export function createTabBarScreenOptions(theme: Theme): TabScreenOptions {
  return {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.textSecondary,
  };
}

export function createTabBarStyle(theme: Theme) {
  return {
    backgroundColor: theme.colors.card,
    borderTopColor: theme.colors.divider,
    borderTopWidth: 1,
  };
}

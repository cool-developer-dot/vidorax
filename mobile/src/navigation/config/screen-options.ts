import type { Theme } from '@/theme';

import type { StackScreenOptions } from '../types/navigation';

import { navigationAnimations } from './transitions';

export const headerDefaults: Pick<
  StackScreenOptions,
  'headerShown' | 'headerBackTitleVisible' | 'headerShadowVisible'
> = {
  headerShown: false,
  headerBackTitleVisible: false,
  headerShadowVisible: false,
};

export function createHiddenHeaderOptions(
  overrides?: StackScreenOptions,
): StackScreenOptions {
  return {
    ...headerDefaults,
    ...overrides,
  };
}

export function createStackHeaderOptions(
  title: string,
  theme: Theme,
  overrides?: StackScreenOptions,
): StackScreenOptions {
  return {
    headerShown: true,
    title,
    headerBackTitleVisible: false,
    headerShadowVisible: false,
    animation: navigationAnimations.push,
    headerStyle: {
      backgroundColor: theme.colors.background,
    },
    headerTintColor: theme.colors.primary,
    headerTitleStyle: {
      color: theme.colors.textPrimary,
    },
    ...overrides,
  };
}

export function createTransparentHeaderOptions(
  title: string,
  theme: Theme,
  overrides?: StackScreenOptions,
): StackScreenOptions {
  return createStackHeaderOptions(title, theme, {
    headerTransparent: true,
    ...overrides,
  });
}

export const rootStackScreenOptions: StackScreenOptions = {
  ...headerDefaults,
  animation: navigationAnimations.push,
};

export const authStackScreenOptions: StackScreenOptions = {
  ...headerDefaults,
  animation: navigationAnimations.fade,
  gestureEnabled: false,
};

export const appStackScreenOptions: StackScreenOptions = {
  ...headerDefaults,
  animation: navigationAnimations.push,
};

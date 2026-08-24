import { animations } from './animations';
import { colors, type ColorTokenKey, type ColorTokens, type ThemeMode } from './colors';
import { elevation } from './elevation';
import { iconColors, icons } from './icons';
import { opacity } from './opacity';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';

const sharedTokens = {
  spacing,
  typography,
  radius,
  elevation,
  animations,
  icons,
  iconColors,
  opacity,
} as const;

export const themes = {
  light: {
    colors: colors.light,
    ...sharedTokens,
  },
  dark: {
    colors: colors.dark,
    ...sharedTokens,
  },
} as const;

export type Theme = {
  colors: ColorTokens;
  spacing: typeof spacing;
  typography: typeof typography;
  radius: typeof radius;
  elevation: typeof elevation;
  animations: typeof animations;
  icons: typeof icons;
  iconColors: typeof iconColors;
  opacity: typeof opacity;
};

export {
  animations,
  colors,
  elevation,
  iconColors,
  icons,
  opacity,
  radius,
  spacing,
  typography,
};

export { applyNativeColorScheme } from './apply-native-color-scheme';

export type { ColorTokenKey, ColorTokens, ThemeMode };

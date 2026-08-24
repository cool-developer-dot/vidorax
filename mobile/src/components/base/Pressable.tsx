import { forwardRef, memo, useCallback, useMemo } from 'react';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type PressableProps = RNPressableProps & {
  pressedOpacity?: number;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

export const Pressable = memo(
  forwardRef<View, PressableProps>(function Pressable(
    { disabled, pressedOpacity, style, onPressIn, onPressOut, ...rest },
    ref,
  ) {
    const theme = useTheme();
    const opacity = pressedOpacity ?? theme.opacity.pressed;

    const resolvedStyle = useCallback(
      (state: PressableStateCallbackType) => {
        const baseStyle = typeof style === 'function' ? style(state) : style;

        return [
          baseStyle,
          state.pressed && !disabled ? { opacity } : null,
          disabled ? { opacity: theme.opacity.disabled } : null,
        ];
      },
      [disabled, opacity, style, theme.opacity.disabled],
    );

    const accessibilityState = useMemo(
      () => ({
        disabled: Boolean(disabled),
        ...rest.accessibilityState,
      }),
      [disabled, rest.accessibilityState],
    );

    return (
      <RNPressable
        ref={ref}
        disabled={disabled}
        accessibilityState={accessibilityState}
        style={resolvedStyle}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        {...rest}
      />
    );
  }),
);

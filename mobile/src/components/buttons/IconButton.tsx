import { forwardRef, memo, useCallback, useMemo } from 'react';
import { type View } from 'react-native';

import { Icon, type IconName } from '@/components/base/Icon';
import { Pressable } from '@/components/base/Pressable';
import { Loader } from '@/components/common/Loader';
import { useTheme } from '@/hooks/use-theme';

import { buttonMetrics, getButtonIconColor, getButtonVisualStyle, type ButtonSize, type ButtonVariant } from './button-styles';

export type IconButtonProps = {
  icon: IconName;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
};

export const IconButton = memo(
  forwardRef<View, IconButtonProps>(function IconButton(
    {
      icon,
      variant = 'ghost',
      size = 'medium',
      loading = false,
      disabled = false,
      onPress,
      accessibilityLabel,
      accessibilityHint,
      testID,
    },
    ref,
  ) {
    const theme = useTheme();
    const metrics = buttonMetrics[size];
    const isDisabled = disabled || loading;
    const visualStyle = useMemo(
      () => getButtonVisualStyle(theme, variant, isDisabled),
      [isDisabled, theme, variant],
    );
    const iconColor = getButtonIconColor(variant, isDisabled);

    const handlePress = useCallback(() => {
      if (!isDisabled) {
        onPress?.();
      }
    }, [isDisabled, onPress]);

    return (
      <Pressable
        ref={ref}
        testID={testID}
        onPress={handlePress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={{
          width: metrics.height,
          height: metrics.height,
          borderRadius: metrics.borderRadius,
          backgroundColor: visualStyle.backgroundColor,
          borderColor: visualStyle.borderColor,
          borderWidth: visualStyle.borderWidth,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {loading ? (
          <Loader size="small" color={visualStyle.textColor} />
        ) : (
          <Icon name={icon} size={metrics.iconSize} color={iconColor} />
        )}
      </Pressable>
    );
  }),
);

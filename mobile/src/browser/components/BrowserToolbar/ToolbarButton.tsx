import { memo } from 'react';

import { IconButton } from '@/components/buttons/IconButton';
import type { IconName } from '@/components/base/Icon';

export type ToolbarButtonProps = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

export const ToolbarButton = memo(function ToolbarButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  testID,
}: ToolbarButtonProps) {
  return (
    <IconButton
      icon={icon}
      variant="ghost"
      size="medium"
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  );
});

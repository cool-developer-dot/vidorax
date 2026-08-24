import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/base/Text';
import { useTheme } from '@/hooks/use-theme';
import { icons } from '@/theme/icons';
import { getInitials } from '@/utils/get-initials';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export type AvatarProps = {
  source?: string | null;
  label?: string;
  size?: AvatarSize;
  testID?: string;
};

const avatarSizes: Record<AvatarSize, number> = {
  sm: icons.md,
  md: icons.lg,
  lg: icons.xl,
  xl: 80,
};

export const Avatar = memo(function Avatar({
  source,
  label,
  size = 'md',
  testID,
}: AvatarProps) {
  const theme = useTheme();
  const dimension = avatarSizes[size];
  const initials = useMemo(() => getInitials(label), [label]);
  const accessibilityLabel = label?.trim() || 'User avatar';

  if (source) {
    return (
      <Image
        testID={testID}
        source={{ uri: source }}
        style={{
          width: dimension,
          height: dimension,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.surface,
        }}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        variant={size === 'xl' ? 'title' : 'caption'}
        color="white"
        accessibilityElementsHidden
        importantForAccessibility="no">
        {initials}
      </Text>
    </View>
  );
});

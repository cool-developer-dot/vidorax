import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/base/Text';
import { getInitials } from '@/utils/get-initials';

import { useProfileTokens } from '../theme/profile-tokens';

export type ProfileAvatarProps = {
  source?: string | null;
  name: string;
  size?: number;
  testID?: string;
};

/**
 * Flagship profile avatar — soft blue gradient initials, ring, and depth.
 */
export const ProfileAvatar = memo(function ProfileAvatar({
  source,
  name,
  size = 104,
  testID = 'profile-avatar',
}: ProfileAvatarProps) {
  const profileTokens = useProfileTokens();
  const initials = useMemo(() => getInitials(name), [name]);
  const accessibilityLabel = name.trim() || 'User avatar';
  const ring = 4;
  const outer = size + ring * 2;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          padding: ring,
          backgroundColor: profileTokens.avatarRing,
          alignItems: 'center',
          justifyContent: 'center',
        },
        profileTokens.elevation.avatar,
      ]}>
      {source ? (
        <Image
          source={{ uri: source }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: profileTokens.background,
          }}
          accessibilityLabel={accessibilityLabel}
        />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
          <Svg width={size} height={size} style={{ position: 'absolute' }}>
            <Defs>
              <LinearGradient id="profileAvatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={profileTokens.avatarGradientStart} />
                <Stop offset="55%" stopColor={profileTokens.avatarGradientMid} />
                <Stop offset="100%" stopColor={profileTokens.avatarGradientEnd} />
              </LinearGradient>
            </Defs>
            <Rect width={size} height={size} fill="url(#profileAvatarGrad)" />
          </Svg>
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityElementsHidden
            importantForAccessibility="no">
            <Text
              variant="h2"
              color="white"
              style={{
                letterSpacing: 1,
                fontSize: size * 0.32,
                lineHeight: size * 0.4,
              }}>
              {initials}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

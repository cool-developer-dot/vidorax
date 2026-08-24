import { memo, useMemo } from 'react';
import { Dimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Box } from '@/components/base/Box';
import { Text } from '@/components/base/Text';
import { useTranslation } from '@/localization';
import { formatMemberSince } from '@/utils/format-date';
import { useProfileTokens } from '../theme/profile-tokens';
import { AvatarEditor } from './AvatarEditor';
import { ProfileAvatar } from './ProfileAvatar';
import { StatusBadge } from './StatusBadge';

export type ProfileHeaderProps = {
  user: import('@/api/types').Profile;
  /** Renders the avatar as a tappable photo editor instead of a static image. */
  editableAvatar?: boolean;
  testID?: string;
};

const HERO_WASH_HEIGHT = 220;

/**
 * Flagship profile hero — focal visual of the screen.
 */
export const ProfileHeader = memo(function ProfileHeader({
  user,
  editableAvatar = false,
  testID = 'profile-header',
}: ProfileHeaderProps) {
  const profileTokens = useProfileTokens();
  const { t } = useTranslation();
  const firstName = useMemo(() => {
    const part = user.name.trim().split(/\s+/)[0];
    return part || user.name;
  }, [user.name]);

  const memberSince = useMemo(
    () => formatMemberSince(user.createdAt),
    [user.createdAt],
  );

  const washWidth = Dimensions.get('window').width;

  return (
    <View
      testID={testID}
      // Grouping the hero into one a11y element would hide the avatar button,
      // so the group is only collapsed when the avatar is not interactive.
      accessible={!editableAvatar}
      accessibilityRole="header"
      accessibilityLabel={t('profile.a11yProfile', {
        name: user.name,
        email: user.email,
        date: memberSince,
      })}
      style={{
        marginHorizontal: -profileTokens.spacing.screenX,
        marginBottom: 8,
        overflow: 'hidden',
      }}>
      <Svg
        width={washWidth}
        height={HERO_WASH_HEIGHT}
        style={{ position: 'absolute', top: 0, left: 0 }}
        pointerEvents="none">
        <Defs>
          <LinearGradient id="heroWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={profileTokens.heroWashTop} />
            <Stop offset="100%" stopColor={profileTokens.heroWashBottom} />
          </LinearGradient>
        </Defs>
        <Rect width={washWidth} height={HERO_WASH_HEIGHT} fill="url(#heroWash)" />
      </Svg>

      <Box
        center
        gap={16}
        style={{
          paddingTop: profileTokens.spacing.heroTop,
          paddingBottom: profileTokens.spacing.heroBottom,
          paddingHorizontal: profileTokens.spacing.screenX,
        }}>
        {editableAvatar ? (
          <AvatarEditor
            name={user.name}
            avatarUrl={user.avatarUrl}
            size={104}
            testID={`${testID}-avatar-editor`}
          />
        ) : (
          <ProfileAvatar
            source={user.avatarUrl}
            name={user.name}
            size={104}
            testID={`${testID}-avatar`}
          />
        )}

        <Box center gap={8}>
          <Text
            variant="caption"
            style={{
              color: profileTokens.primary,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              fontSize: 12,
              lineHeight: 16,
            }}>
            {t('profile.welcomePrefix')} {firstName}
          </Text>

          <Text
            variant="h2"
            align="center"
            accessibilityRole="header"
            style={{
              letterSpacing: -0.6,
              color: profileTokens.textPrimary,
            }}>
            {user.name}
          </Text>

          <Text
            variant="bodySmall"
            align="center"
            style={{ color: profileTokens.textSecondary, letterSpacing: -0.1 }}>
            {user.email}
          </Text>
        </Box>

        <Box
          row
          center
          gap={8}
          style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <StatusBadge
            label={user.emailVerified ? t('profile.verified') : t('profile.unverified')}
            tone={user.emailVerified ? 'verified' : 'unverified'}
            testID={
              user.emailVerified
                ? `${testID}-verified`
                : `${testID}-unverified`
            }
          />
          {user.role === 'ADMIN' ? (
            <StatusBadge
              label={t('profile.admin')}
              tone="admin"
              testID={`${testID}-admin`}
            />
          ) : null}
        </Box>

        <Text
          variant="caption"
          align="center"
          style={{ color: profileTokens.textMuted, marginTop: 2 }}>
          {t('profile.memberSince', { date: memberSince })}
        </Text>
      </Box>
    </View>
  );
});

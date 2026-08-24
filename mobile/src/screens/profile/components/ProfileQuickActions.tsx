import { memo, useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { Box } from '@/components/base/Box';
import { Icon, type IconName } from '@/components/base/Icon';
import { Pressable } from '@/components/base/Pressable';
import { Text } from '@/components/base/Text';
import { useTranslation } from '@/localization';
import { push, routePaths } from '@/navigation';
import { useProfileTokens } from '../theme/profile-tokens';
import { ProfileSection } from './ProfileSection';

export type ProfileQuickActionsProps = {
  testID?: string;
};

type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  onPress?: () => void;
  accessibilityHint?: string;
};

const ActionRow = memo(function ActionRow({
  action,
  isLast,
  testID,
}: {
  action: QuickAction;
  isLast: boolean;
  testID: string;
}) {
  const { rtl } = useTranslation();
  const profileTokens = useProfileTokens();
  const interactive = Boolean(action.onPress);

  const content = (
    <Box
      row
      center
      gap={14}
      py={14}
      style={{ minHeight: 64 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: profileTokens.actionIconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={action.icon} size="md" color="primary" />
      </View>

      <Box flex={1} gap={3}>
        <Text
          variant="body"
          style={{
            letterSpacing: -0.2,
            lineHeight: 22,
            color: profileTokens.textPrimary,
          }}>
          {action.title}
        </Text>
        <Text
          variant="caption"
          style={{ lineHeight: 16, color: profileTokens.textSecondary }}>
          {action.subtitle}
        </Text>
      </Box>

      <Icon name={rtl.chevronForward} size="sm" color="secondary" />
    </Box>
  );

  return (
    <View testID={testID}>
      {interactive ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.title}
          accessibilityHint={action.accessibilityHint}
          style={{ minHeight: 44 }}>
          {content}
        </Pressable>
      ) : (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${action.title}. ${action.subtitle}`}
          accessibilityState={{ disabled: true }}>
          {content}
        </View>
      )}
      {!isLast ? (
        <View
          style={{
            height: 1,
            ...(rtl.isRtl ? { marginRight: 54 } : { marginLeft: 54 }),
            backgroundColor: profileTokens.divider,
          }}
        />
      ) : null}
    </View>
  );
});

export const ProfileQuickActions = memo(function ProfileQuickActions({
  testID = 'profile-quick-actions',
}: ProfileQuickActionsProps) {
  const { t } = useTranslation();
  const openAbout = useCallback(() => {
    push(routePaths.about);
  }, []);

  const openEditProfile = useCallback(() => {
    push(routePaths.editProfile);
  }, []);

  const openPrivacy = useCallback(() => {
    push(routePaths.privacy);
  }, []);

  const actions = useMemo<QuickAction[]>(
    () => [
      {
        id: 'edit-profile',
        title: t('profile.editProfile'),
        subtitle: t('profile.editProfileSubtitle'),
        icon: 'account-edit-outline',
        onPress: openEditProfile,
        accessibilityHint: t('profile.editProfileHint'),
      },
      {
        id: 'privacy',
        title: t('profile.privacy'),
        subtitle: t('profile.privacySubtitle'),
        icon: 'shield-lock-outline',
        onPress: openPrivacy,
        accessibilityHint: t('profile.privacyHint'),
      },
      {
        id: 'about',
        title: t('profile.about'),
        subtitle: t('profile.aboutSubtitle'),
        icon: 'information-outline',
        onPress: openAbout,
        accessibilityHint: t('profile.aboutHint'),
      },
    ],
    [openAbout, openEditProfile, openPrivacy, t],
  );

  return (
    <ProfileSection
      testID={testID}
      title={t('profile.actionsSection')}
      description={t('profile.actionsDescription')}
      icon="lightning-bolt-outline">
      {actions.map((action, index) => (
        <ActionRow
          key={action.id}
          action={action}
          isLast={index === actions.length - 1}
          testID={`${testID}-${action.id}`}
        />
      ))}
    </ProfileSection>
  );
});

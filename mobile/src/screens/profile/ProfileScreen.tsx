import { memo } from 'react';
import { View } from 'react-native';

import { Box } from '@/components/base/Box';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { SafeAreaScreen } from '@/components/common/SafeAreaScreen';
import { useTranslation } from '@/localization';

import {
  AccountInfoCard,
  AppInfoCard,
  ProfileHeader,
  ProfileQuickActions,
  ProfileSkeleton,
  ProfileStaggerItem,
} from './components';
import { useProfileScreen } from './hooks';
import { useProfileTokens } from './theme/profile-tokens';

export const ProfileScreen = memo(function ProfileScreen() {
  const profileTokens = useProfileTokens();
  const { t } = useTranslation();
  const { user, status, refreshing, error, refresh, retry } = useProfileScreen();

  return (
    <SafeAreaScreen
      testID="profile-screen"
      scrollable
      padded={false}
      edges={['bottom', 'left', 'right']}
      refreshing={refreshing}
      onRefresh={refresh}
      style={{ backgroundColor: profileTokens.background }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: profileTokens.spacing.screenX,
        paddingBottom: 40,
        backgroundColor: profileTokens.background,
      }}>
      {status === 'loading' ? <ProfileSkeleton /> : null}

      {status === 'error' && error ? (
        <Box flex={1} center py={48}>
          <ErrorState
            title={error.title}
            message={error.message}
            onRetry={retry}
            testID="profile-error-state"
          />
        </Box>
      ) : null}

      {status === 'empty' ? (
        <Box flex={1} center py={48}>
          <EmptyState
            icon="account-off-outline"
            title={t('profile.emptyTitle')}
            description={t('profile.emptyDescription')}
            actionLabel={t('common.retry')}
            onActionPress={retry}
            testID="profile-empty-state"
          />
        </Box>
      ) : null}

      {status === 'ready' && user ? (
        <View>
          <ProfileStaggerItem index={0} hero>
            <ProfileHeader user={user} editableAvatar />
          </ProfileStaggerItem>

          <View style={{ gap: profileTokens.spacing.sectionGap }}>
            <ProfileStaggerItem index={1}>
              <AccountInfoCard user={user} />
            </ProfileStaggerItem>

            <ProfileStaggerItem index={2}>
              <AppInfoCard />
            </ProfileStaggerItem>

            <ProfileStaggerItem index={3}>
              <ProfileQuickActions />
            </ProfileStaggerItem>
          </View>
        </View>
      ) : null}
    </SafeAreaScreen>
  );
});

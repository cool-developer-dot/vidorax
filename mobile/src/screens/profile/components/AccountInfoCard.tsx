import { memo, useMemo } from 'react';

import type { Profile } from '@/api/types';

import { useTranslation } from '@/localization';
import { ProfileInfoRow } from './ProfileInfoRow';
import { ProfileSection } from './ProfileSection';
import { StatusBadge } from './StatusBadge';

export type AccountInfoCardProps = {
  user: Profile;
  testID?: string;
};

export const AccountInfoCard = memo(function AccountInfoCard({
  user,
  testID = 'profile-account-card',
}: AccountInfoCardProps) {
  const { t } = useTranslation();
  const statusLabel = useMemo(
    () => (user.emailVerified ? t('profile.verified') : t('profile.unverified')),
    [t, user.emailVerified],
  );
  const statusTone = user.emailVerified ? 'verified' : 'unverified';

  return (
    <ProfileSection
      testID={testID}
      title={t('profile.accountSection')}
      description={t('profile.actionsDescription')}
      icon="account-circle-outline">
      <ProfileInfoRow
        label={t('auth.nameLabel')}
        value={user.name}
        testID={`${testID}-name`}
      />
      <ProfileInfoRow
        label={t('auth.emailLabel')}
        value={user.email}
        testID={`${testID}-email`}
      />
      <ProfileInfoRow
        label={t('profile.accountStatus')}
        value={statusLabel}
        showDivider={__DEV__}
        trailingOnly
        trailing={
          <StatusBadge
            label={statusLabel}
            tone={statusTone}
            testID={`${testID}-status-badge`}
          />
        }
        testID={`${testID}-status`}
      />
      {__DEV__ ? (
        <ProfileInfoRow
          label={t('profile.userId')}
          value={user.id}
          showDivider={false}
          truncate
          testID={`${testID}-user-id`}
        />
      ) : null}
    </ProfileSection>
  );
});

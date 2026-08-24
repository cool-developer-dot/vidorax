import { memo, useMemo } from 'react';

import { getAppIdentityMetadata } from '@/constants/app-identity';
import { environment } from '@/constants/environment';
import { useTranslation } from '@/localization';
import { ProfileInfoRow } from './ProfileInfoRow';
import { ProfileSection } from './ProfileSection';

export type AppInfoCardProps = {
  testID?: string;
};

export const AppInfoCard = memo(function AppInfoCard({
  testID = 'profile-app-card',
}: AppInfoCardProps) {
  const { t } = useTranslation();
  const meta = useMemo(() => getAppIdentityMetadata(), []);
  const showEnvironment = environment.isDevelopment;

  return (
    <ProfileSection
      testID={testID}
      title={t('profile.appSection')}
      description={t('profile.appSectionDescription')}
      icon="cellphone-information"
      secondary>
      <ProfileInfoRow
        label={t('profile.appVersion')}
        value={meta.version}
        secondary
        testID={`${testID}-version`}
      />
      <ProfileInfoRow
        label={t('profile.buildVersion')}
        value={meta.build}
        secondary
        testID={`${testID}-build`}
      />
      {showEnvironment ? (
        <ProfileInfoRow
          label={t('profile.environment')}
          value={t('profile.environmentDevelopment')}
          secondary
          testID={`${testID}-environment`}
        />
      ) : null}
      <ProfileInfoRow
        label={t('profile.platform')}
        value={meta.platformLabel}
        secondary
        showDivider={false}
        testID={`${testID}-platform`}
      />
    </ProfileSection>
  );
});

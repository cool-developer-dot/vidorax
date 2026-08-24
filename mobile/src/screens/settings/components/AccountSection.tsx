import { memo, useCallback } from 'react';

import { push, routePaths } from '@/navigation';
import { useTranslation } from '@/localization';

import { SettingsRow } from './SettingsRow';
import { SettingsSection } from './SettingsSection';

export type AccountSectionProps = {
  onSignOut: () => void;
  testID?: string;
};

/**
 * Settings → Account: Profile + Sign Out (working destinations only).
 */
export const AccountSection = memo(function AccountSection({
  onSignOut,
  testID = 'settings-account',
}: AccountSectionProps) {
  const { t } = useTranslation();

  const openProfile = useCallback(() => {
    push(routePaths.profile);
  }, []);

  return (
    <SettingsSection
      testID={testID}
      title={t('settings.accountSectionTitle')}
      description={t('settings.accountSectionDescription')}
      icon="account-circle-outline">
      <SettingsRow
        title={t('settings.profile')}
        description={t('settings.profileHint')}
        icon="account-circle-outline"
        onPress={openProfile}
        accessibilityHint={t('settings.profileA11y')}
        testID={`${testID}-profile`}
      />
      <SettingsRow
        title={t('settings.signOut')}
        description={t('settings.signOutHint')}
        icon="logout"
        onPress={onSignOut}
        destructive
        showDivider={false}
        accessibilityHint={t('settings.signOutA11y')}
        testID={`${testID}-sign-out`}
      />
    </SettingsSection>
  );
});

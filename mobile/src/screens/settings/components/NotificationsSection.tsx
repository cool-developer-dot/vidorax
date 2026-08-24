import { memo } from 'react';

import { Switch } from '@/components/inputs/Switch';
import { useTranslation } from '@/localization';
import { SettingsRow } from './SettingsRow';
import { SettingsSection } from './SettingsSection';

export type NotificationsSectionProps = {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

export const NotificationsSection = memo(function NotificationsSection({
  enabled,
  onEnabledChange,
  disabled = false,
  testID = 'settings-notifications',
}: NotificationsSectionProps) {
  const { t } = useTranslation();
  return (
    <SettingsSection
      testID={testID}
      title={t('settings.notificationsSection')}
      description={t('settings.notificationsDescription')}
      icon="bell-outline">
      <SettingsRow
        title={t('settings.notifications')}
        description={t('settings.notificationsHint')}
        icon="bell-ring-outline"
        trailing={
          <Switch
            value={enabled}
            onValueChange={onEnabledChange}
            disabled={disabled}
            accessibilityLabel={t('settings.notifications')}
            accessibilityHint={t('settings.notificationsHint')}
            testID={`${testID}-enabled-switch`}
          />
        }
        showDivider={false}
        accessibilityHint={t('settings.notificationsHint')}
        testID={`${testID}-enabled`}
      />
    </SettingsSection>
  );
});

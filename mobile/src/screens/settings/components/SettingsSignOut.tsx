import { memo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/buttons/Button';
import { useTranslation } from '@/localization';
import { useSettingsTokens } from '../theme/settings-tokens';

export type SettingsSignOutProps = {
  onPress: () => void;
  testID?: string;
};

export const SettingsSignOut = memo(function SettingsSignOut({
  onPress,
  testID = 'settings-sign-out',
}: SettingsSignOutProps) {
  const settingsTokens = useSettingsTokens();
  const { t } = useTranslation();
  return (
    <View
      style={{
        marginTop: 8,
        paddingTop: 8,
        paddingBottom: 8,
      }}>
      <Button
        title={t('settings.signOut')}
        variant="ghost"
        fullWidth
        onPress={onPress}
        testID={testID}
        accessibilityLabel={t('settings.signOut')}
        style={{
          minHeight: 48,
          borderRadius: settingsTokens.radius.row,
        }}
      />
    </View>
  );
});

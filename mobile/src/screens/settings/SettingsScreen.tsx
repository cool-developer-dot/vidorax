import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { Box } from '@/components/base/Box';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { SafeAreaScreen } from '@/components/common/SafeAreaScreen';
import { apiThemeToPreference } from '@/services/auth/settings-validation';
import { languageNameKey, useTranslation } from '@/localization';

import {
  AccountSection,
  AppearanceSection,
  DownloadsSection,
  GeneralSection,
  LegalSection,
  SettingsFeedbackBanner,
  SettingsHeader,
  SettingsSkeleton,
  SettingsStaggerItem,
  StorageSection,
  SupportSection,
} from './components';
import { useSettingsScreen } from './hooks';
import { useSettingsTokens } from './theme/settings-tokens';

export const SettingsScreen = memo(function SettingsScreen() {
  const settingsTokens = useSettingsTokens();
  const { t, language } = useTranslation();
  const {
    settings,
    display,
    status,
    refreshing,
    saving,
    error,
    feedback,
    languageSheetVisible,
    openLanguageSheet,
    closeLanguageSheet,
    refresh,
    retry,
    signOut,
    setTheme,
    setLanguage,
  } = useSettingsScreen();

  const themeMode = useMemo(
    () => (settings ? apiThemeToPreference(settings.theme) : 'system'),
    [settings],
  );

  return (
    <SafeAreaScreen
      testID="settings-screen"
      scrollable
      padded={false}
      edges={['top', 'bottom', 'left', 'right']}
      refreshing={refreshing}
      onRefresh={refresh}
      style={{ backgroundColor: settingsTokens.background }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: settingsTokens.spacing.screenX,
        paddingBottom: 40,
        backgroundColor: settingsTokens.background,
      }}>
      {status === 'loading' ? <SettingsSkeleton /> : null}

      {status === 'error' && error ? (
        <Box flex={1} center py={48}>
          <ErrorState
            title={t(error.titleKey)}
            message={t(error.messageKey)}
            onRetry={retry}
            testID="settings-error-state"
          />
        </Box>
      ) : null}

      {status === 'empty' ? (
        <Box flex={1} center py={48}>
          <EmptyState
            icon="cog-off-outline"
            title={t('settings.emptyTitle')}
            description={t('settings.emptyDescription')}
            actionLabel={t('common.retry')}
            onActionPress={retry}
            testID="settings-empty-state"
          />
        </Box>
      ) : null}

      {status === 'ready' && display && settings ? (
        <View
          accessible={false}
          accessibilityState={{ busy: saving }}
          importantForAccessibility="yes">
          <SettingsStaggerItem index={0} hero>
            <SettingsHeader />
          </SettingsStaggerItem>

          <SettingsFeedbackBanner
            visible={Boolean(feedback)}
            tone={feedback?.tone}
            title={feedback ? t(feedback.titleKey) : ''}
            message={feedback ? t(feedback.messageKey) : ''}
          />

          <View style={{ gap: settingsTokens.spacing.sectionGap }}>
            <SettingsStaggerItem index={1}>
              <AppearanceSection
                themeMode={themeMode}
                onThemeChange={setTheme}
                disabled={saving}
              />
            </SettingsStaggerItem>

            <SettingsStaggerItem index={2}>
              <GeneralSection
                languageLabel={t(languageNameKey(language))}
                languageCode={language}
                sheetVisible={languageSheetVisible}
                onOpenSheet={openLanguageSheet}
                onCloseSheet={closeLanguageSheet}
                onSelectLanguage={setLanguage}
                disabled={saving}
              />
            </SettingsStaggerItem>

            <SettingsStaggerItem index={3}>
              <DownloadsSection />
            </SettingsStaggerItem>

            <SettingsStaggerItem index={4}>
              <StorageSection />
            </SettingsStaggerItem>

            <SettingsStaggerItem index={5}>
              <AccountSection onSignOut={signOut} />
            </SettingsStaggerItem>

            <SettingsStaggerItem index={6}>
              <SupportSection />
            </SettingsStaggerItem>

            <SettingsStaggerItem index={7}>
              <LegalSection />
            </SettingsStaggerItem>
          </View>
        </View>
      ) : null}
    </SafeAreaScreen>
  );
});

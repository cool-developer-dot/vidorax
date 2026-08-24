import { Stack } from 'expo-router';
import { useMemo } from 'react';

import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/localization';
import {
  appStackRouteNames,
  appStackScreenOptions,
  createContentStyleOptions,
  createHiddenHeaderOptions,
  createStackHeaderOptions,
  ProtectedRouteGuard,
} from '@/navigation';

export default function AppLayout() {
  const theme = useTheme();
  const { t } = useTranslation();

  const screenOptions = useMemo(
    () => ({
      ...appStackScreenOptions,
      ...createContentStyleOptions(theme.colors.background),
    }),
    [theme.colors.background],
  );

  const profileHeaderOptions = useMemo(
    () => createStackHeaderOptions(t('nav.profile'), theme),
    [t, theme],
  );
  const editProfileHeaderOptions = useMemo(
    () => createStackHeaderOptions(t('nav.editProfile'), theme),
    [t, theme],
  );
  const aboutHeaderOptions = useMemo(
    () => createStackHeaderOptions(t('nav.about'), theme),
    [t, theme],
  );
  const supportHeaderOptions = useMemo(
    () => createStackHeaderOptions(t('nav.support'), theme),
    [t, theme],
  );
  const reportProblemHeaderOptions = useMemo(
    () => createStackHeaderOptions(t('nav.reportProblem'), theme),
    [t, theme],
  );
  const downloadSettingsHeaderOptions = useMemo(
    () => createStackHeaderOptions(t('nav.downloadSettings'), theme),
    [t, theme],
  );
  const privacyHeaderOptions = useMemo(
    () => createStackHeaderOptions(t('nav.privacy'), theme),
    [t, theme],
  );
  const termsHeaderOptions = useMemo(
    () => createStackHeaderOptions(t('nav.terms'), theme),
    [t, theme],
  );
  const historyHeaderOptions = useMemo(
    () => createHiddenHeaderOptions(),
    [],
  );

  return (
    <ProtectedRouteGuard>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen
          name={appStackRouteNames.tabs}
          options={createHiddenHeaderOptions()}
        />
        <Stack.Screen
          name={appStackRouteNames.profile}
          options={profileHeaderOptions}
        />
        <Stack.Screen
          name={appStackRouteNames.editProfile}
          options={editProfileHeaderOptions}
        />
        <Stack.Screen name={appStackRouteNames.about} options={aboutHeaderOptions} />
        <Stack.Screen
          name={appStackRouteNames.support}
          options={supportHeaderOptions}
        />
        <Stack.Screen
          name={appStackRouteNames.reportProblem}
          options={reportProblemHeaderOptions}
        />
        <Stack.Screen
          name={appStackRouteNames.privacy}
          options={privacyHeaderOptions}
        />
        <Stack.Screen
          name={appStackRouteNames.terms}
          options={termsHeaderOptions}
        />
        <Stack.Screen
          name={appStackRouteNames.history}
          options={historyHeaderOptions}
        />
        <Stack.Screen
          name={appStackRouteNames.watchHistory}
          options={createHiddenHeaderOptions()}
        />
        <Stack.Screen
          name={appStackRouteNames.bookmarks}
          options={createHiddenHeaderOptions()}
        />
        <Stack.Screen
          name={appStackRouteNames.favorites}
          options={createHiddenHeaderOptions()}
        />
        <Stack.Screen
          name={appStackRouteNames.downloadSettings}
          options={downloadSettingsHeaderOptions}
        />
        <Stack.Screen
          name={appStackRouteNames.downloadDetails}
          options={createHiddenHeaderOptions()}
        />
      </Stack>
    </ProtectedRouteGuard>
  );
}

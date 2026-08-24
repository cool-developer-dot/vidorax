import { Stack, usePathname } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import {
  authRouteNames,
  authStackScreenOptions,
  createContentStyleOptions,
  createFadeScreenOptions,
  createPushScreenOptions,
  GuestRouteGuard,
} from '@/navigation';
import { AuthCredentialScreen } from '@/screens/auth/AuthCredentialScreen';

function isCredentialPath(pathname: string): boolean {
  return pathname.includes('sign-in') || pathname.includes('sign-up');
}

export default function AuthLayout() {
  const theme = useTheme();
  const pathname = usePathname();
  const showCredentials = isCredentialPath(pathname);

  const screenOptions = useMemo(
    () => ({
      ...authStackScreenOptions,
      ...createContentStyleOptions(theme.colors.background),
    }),
    [theme.colors.background],
  );

  const fadeOptions = useMemo(() => createFadeScreenOptions(), []);
  const pushOptions = useMemo(() => createPushScreenOptions(), []);
  const credentialOptions = useMemo(
    () => ({
      headerShown: false,
      animation: 'none' as const,
      gestureEnabled: false,
      // Transparent so the persistent flip shell above the stack is visible.
      contentStyle: { backgroundColor: 'transparent' },
    }),
    [],
  );

  return (
    <GuestRouteGuard>
      <View style={styles.root}>
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name={authRouteNames.splash} options={fadeOptions} />
          <Stack.Screen name={authRouteNames.onboarding} options={fadeOptions} />
          <Stack.Screen
            name={authRouteNames['sign-up']}
            options={credentialOptions}
          />
          <Stack.Screen
            name={authRouteNames['sign-in']}
            options={credentialOptions}
          />
          <Stack.Screen
            name={authRouteNames['forgot-password']}
            options={pushOptions}
          />
        </Stack>

        {showCredentials ? (
          <View
            style={styles.credentialsOverlay}
            pointerEvents="auto"
            testID="auth-credentials-overlay">
            <AuthCredentialScreen />
          </View>
        ) : null}
      </View>
    </GuestRouteGuard>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  credentialsOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    elevation: 2,
  },
});

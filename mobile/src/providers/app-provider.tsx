import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as SplashScreen from 'expo-splash-screen';
import { type PropsWithChildren, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/common/error-boundary';
import { useAppFonts } from '@/hooks/use-app-fonts';
import { LocalizationProvider } from '@/localization';
import { SessionProvider } from '@/navigation/SessionProvider';
import { AppInitializerProvider, useAppInitializerState } from '@/providers/app-initializer-provider';
import { AppPaperProvider } from '@/providers/paper-provider';
import { NavigationThemeProvider } from '@/providers/navigation-theme-provider';
import { QueryProvider } from '@/providers/query-provider';
import { AppStatusBar } from '@/providers/status-bar';

/**
 * Keeps the native splash visible until fonts + bootstrap finish.
 * Always renders children so the root navigator mounts on first paint.
 * Initial linking settlement is gated by `+native-intent` (primary) and
 * `defer-initial-linking` (secondary), so useLinking does not setState
 * before NavigationContainer mounts.
 */
function AppLaunchGate({ children }: PropsWithChildren) {
  const { loaded, error } = useAppFonts();
  const { isReady: isAppReady } = useAppInitializerState();
  const isFontsReady = loaded || Boolean(error);
  const isLaunchReady = isFontsReady && isAppReady;

  useEffect(() => {
    if (isLaunchReady) {
      SplashScreen.hideAsync();
    }
  }, [isLaunchReady]);

  return <>{children}</>;
}

export function AppProvider({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryProvider>
            <AppInitializerProvider>
              <LocalizationProvider>
                <SessionProvider>
                  <AppLaunchGate>
                    <AppPaperProvider>
                      <NavigationThemeProvider>
                        <BottomSheetModalProvider>
                          <AppStatusBar />
                          {children}
                        </BottomSheetModalProvider>
                      </NavigationThemeProvider>
                    </AppPaperProvider>
                  </AppLaunchGate>
                </SessionProvider>
              </LocalizationProvider>
            </AppInitializerProvider>
          </QueryProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from '@/localization';
import { replace, routePaths, useAuthBackHandler } from '@/navigation';
import { useAppStore } from '@/store';

import { OnboardingFooter } from './components';
import { ONBOARDING_COLORS, ONBOARDING_PAGE_COUNT } from './constants';
import { GatewayScreen } from './gateway';
import { LibraryScreen, type LibraryScreenHandle } from './library';
import { TrustScreen } from './trust';

export function OnboardingScreen() {
  const { t } = useTranslation();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const [pageIndex, setPageIndex] = useState(0);
  const [exiting, setExiting] = useState(false);
  const libraryRef = useRef<LibraryScreenHandle>(null);

  useAuthBackHandler();

  const navigateToSignUp = useCallback(() => {
    completeOnboarding();
    replace(routePaths.signUp);
  }, [completeOnboarding]);

  const finish = useCallback(() => {
    if (exiting) {
      return;
    }

    if (pageIndex === ONBOARDING_PAGE_COUNT - 1 && libraryRef.current) {
      setExiting(true);
      libraryRef.current.playExit(navigateToSignUp);
      return;
    }

    navigateToSignUp();
  }, [exiting, navigateToSignUp, pageIndex]);

  const handleSkip = useCallback(() => {
    finish();
  }, [finish]);

  const handleContinue = useCallback(() => {
    if (pageIndex >= ONBOARDING_PAGE_COUNT - 1) {
      finish();
      return;
    }
    setPageIndex((current) => current + 1);
  }, [finish, pageIndex]);

  const footer = (
    <OnboardingFooter
      pageIndex={pageIndex}
      onSkip={handleSkip}
      onContinue={handleContinue}
      continueLabel={
        pageIndex >= ONBOARDING_PAGE_COUNT - 1
          ? t('onboarding.getStarted')
          : t('onboarding.continue')
      }
    />
  );

  return (
    <View style={styles.root} testID="onboarding-screen">
      {pageIndex === 0 ? (
        <GatewayScreen footer={footer} enabled />
      ) : pageIndex === 1 ? (
        <TrustScreen footer={footer} enabled />
      ) : (
        <LibraryScreen ref={libraryRef} footer={footer} enabled />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ONBOARDING_COLORS.background,
  },
});

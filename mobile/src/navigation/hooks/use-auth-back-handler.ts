import { useCallback } from 'react';

import { useAndroidBackHandler } from './use-android-back-handler';

/** Prevents Android back navigation on auth entry screens (splash, onboarding, sign-up). */
export function useAuthBackHandler(enabled = true): void {
  const handleBackPress = useCallback(() => true, []);

  useAndroidBackHandler({ enabled, onBackPress: handleBackPress });
}

import { useCallback } from 'react';
import { Keyboard } from 'react-native';

import { useBrowserEngineContext } from '@/browser/engine';
import {
  selectCanGoBack,
  selectCanGoForward,
  selectIsHome,
  selectIsLoading,
  useBrowserStore,
} from '@/browser/stores';

/**
 * Toolbar / header navigation actions bound to the engine + store flags.
 */
export function useBrowserNavigation() {
  const { goBack, goForward, reload, stopLoading, goHome } = useBrowserEngineContext();

  const canGoBack = useBrowserStore(selectCanGoBack);
  const canGoForward = useBrowserStore(selectCanGoForward);
  const isLoading = useBrowserStore(selectIsLoading);
  const isHome = useBrowserStore(selectIsHome);

  const handleBack = useCallback(() => {
    if (isHome) {
      return;
    }
    // Engine prefers native WebView history, then chrome stack, then Home.
    goBack();
  }, [goBack, isHome]);

  const handleForward = useCallback(() => {
    if (canGoForward) {
      goForward();
    }
  }, [canGoForward, goForward]);

  const handleHome = useCallback(() => {
    Keyboard.dismiss();
    goHome();
  }, [goHome]);

  const handleReloadOrStop = useCallback(() => {
    if (isHome) {
      return;
    }
    if (isLoading) {
      stopLoading();
      return;
    }
    reload();
  }, [isHome, isLoading, reload, stopLoading]);

  return {
    canGoBack: canGoBack || !isHome,
    canGoForward,
    isLoading: isLoading && !isHome,
    isHome,
    handleBack,
    handleForward,
    handleHome,
    handleReloadOrStop,
  };
}

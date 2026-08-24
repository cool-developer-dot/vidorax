import { useEffect, useRef } from 'react';

import { isBrowserHomeUrl } from '@/browser/utils';
import { useBrowserEngineContext } from '@/browser/engine';
import { useBrowserStore } from '@/browser/stores';

import { mediaDetectionEngine } from '../engine';

/**
 * Synchronizes browser navigation → media detection engine.
 * Passive: never mutates browserStore. Passes navigation epoch for stale guards.
 */
export function useMediaDetectionBrowserSync(): void {
  const currentUrl = useBrowserStore((s) => s.currentUrl);
  const isLoading = useBrowserStore((s) => s.isLoading);
  const { navigationEpochRef } = useBrowserEngineContext();
  const prevUrlRef = useRef<string | null>(null);
  const prevLoadingRef = useRef<boolean | null>(null);

  useEffect(() => {
    mediaDetectionEngine.start();
    return () => {
      // Host owns lifecycle — stop only when Host unmounts with the browser screen.
      mediaDetectionEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (isBrowserHomeUrl(currentUrl)) {
      if (prevUrlRef.current !== currentUrl) {
        mediaDetectionEngine.onGoHome();
        prevUrlRef.current = currentUrl;
      }
      return;
    }

    if (prevUrlRef.current !== currentUrl) {
      mediaDetectionEngine.onNavigationStart(
        currentUrl,
        navigationEpochRef.current,
      );
      prevUrlRef.current = currentUrl;
    }
  }, [currentUrl, navigationEpochRef]);

  useEffect(() => {
    if (isBrowserHomeUrl(currentUrl)) {
      prevLoadingRef.current = isLoading;
      return;
    }

    if (prevLoadingRef.current === true && isLoading === false) {
      mediaDetectionEngine.onNavigationComplete(currentUrl);
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, currentUrl]);
}

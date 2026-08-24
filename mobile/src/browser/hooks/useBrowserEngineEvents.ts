import { useCallback, useMemo, useRef } from 'react';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigation,
  WebViewProgressEvent,
  WebViewRenderProcessGoneEvent,
  WebViewTerminatedEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { useBrowserEngineContext } from '@/browser/engine';
import {
  browserSyncService,
  goBackWebView,
  navigationService,
  recordSuccessfulVisit,
} from '@/browser/services';
import { scrollPositionService } from '@/browser/scroll';
import { useBrowserStore } from '@/browser/stores';
import {
  classifyWebViewLoadError,
  createBrowserError,
  isBrowserHomeUrl,
} from '@/browser/utils';
import { mediaDetectionEngine } from '@/media-detection';
import { useHistoryStore } from '@/store/history';

/** Compare main-document URLs ignoring hash (subresource errors use different paths). */
function isSameDocumentNavigationUrl(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    left.hash = '';
    right.hash = '';
    return left.href === right.href;
  } catch {
    return a.trim() === b.trim();
  }
}

export type BrowserEngineEventBridge = {
  onNavigationStateChange: (navState: WebViewNavigation) => void;
  onLoadStart: (url: string) => void;
  onLoadEnd: (url: string) => void;
  onLoadProgress: (event: WebViewProgressEvent) => void;
  onError: (event: WebViewErrorEvent) => void;
  onHttpError: (event: WebViewHttpErrorEvent) => void;
  onContentProcessDidTerminate: (event: WebViewTerminatedEvent) => void;
  onRenderProcessGone: (event: WebViewRenderProcessGoneEvent) => void;
  onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => boolean;
};

/**
 * Synchronizes WebView lifecycle events into browserStore.
 * Used exclusively by BrowserContainer — no UI chrome should subscribe here.
 */
export function useBrowserEngineEvents(): BrowserEngineEventBridge {
  const {
    loadUrl,
    goHome,
    goBack,
    webViewRef,
    navigationEpochRef,
    chromeNavRef,
    nativeCanGoBackRef,
    nativeCanGoForwardRef,
  } = useBrowserEngineContext();
  /** Epoch observed when the active document load started. */
  const loadStartEpochRef = useRef(0);
  /** Throttle high-frequency onLoadProgress → Zustand writes. */
  const lastProgressWriteAtRef = useRef(0);
  const lastProgressValueRef = useRef(0);

  const applyNavigationState = useBrowserStore((state) => state.applyNavigationState);
  const setLoading = useBrowserStore((state) => state.setLoading);
  const setProgress = useBrowserStore((state) => state.setProgress);
  const setPageTitle = useBrowserStore((state) => state.setPageTitle);
  const setError = useBrowserStore((state) => state.setError);
  const clearError = useBrowserStore((state) => state.clearError);
  const markVisited = useBrowserStore((state) => state.markVisited);

  const isStaleEvent = useCallback(() => {
    return loadStartEpochRef.current !== navigationEpochRef.current;
  }, [navigationEpochRef]);

  const onNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      if (!navState.url) {
        return;
      }

      if (navState.url === 'about:blank') {
        if (isBrowserHomeUrl(useBrowserStore.getState().currentUrl)) {
          return;
        }

        // Leftover blank behind a real page — prefer WebView or chrome stack back.
        if (navState.canGoBack) {
          goBackWebView(webViewRef.current);
          return;
        }
        if (chromeNavRef.current.index > 0) {
          goBack();
          return;
        }

        goHome();
        browserSyncService.onGoHome();
        return;
      }

      const state = useBrowserStore.getState();
      if (isBrowserHomeUrl(state.currentUrl)) {
        return;
      }

      // Ignore completed navigations for a prior document while a newer load is in flight.
      if (state.isLoading && !navState.loading && navState.url !== state.currentUrl) {
        return;
      }

      if (isStaleEvent() && !navState.loading && navState.url !== state.currentUrl) {
        return;
      }

      nativeCanGoBackRef.current = Boolean(navState.canGoBack);
      nativeCanGoForwardRef.current = Boolean(navState.canGoForward);

      const chrome = chromeNavRef.current;
      applyNavigationState({
        url: navState.url,
        title: navState.title ?? '',
        canGoBack: navState.canGoBack || chrome.index > 0,
        canGoForward:
          navState.canGoForward ||
          (chrome.index >= 0 && chrome.index < chrome.stack.length - 1),
        loading: navState.loading,
      });

      if (navState.title) {
        setPageTitle(navState.title);
      }

      if (navState.loading) {
        browserSyncService.onNavigate(navState.url, navState.title ?? undefined);
      }
    },
    [
      applyNavigationState,
      chromeNavRef,
      goBack,
      goHome,
      isStaleEvent,
      nativeCanGoBackRef,
      nativeCanGoForwardRef,
      setPageTitle,
      webViewRef,
    ],
  );

  const onLoadStart = useCallback(
    (url: string) => {
      loadStartEpochRef.current = navigationEpochRef.current;

      if (isBrowserHomeUrl(useBrowserStore.getState().currentUrl)) {
        return;
      }
      if (url === 'about:blank') {
        return;
      }

      clearError();
      setLoading(true);
      lastProgressWriteAtRef.current = 0;
      lastProgressValueRef.current = 0;
      scrollPositionService.resetRestoreGuard();
      // URL commits come from navigation state / chrome loadUrl — avoid racing setCurrentUrl here.
    },
    [clearError, navigationEpochRef, setLoading],
  );

  const onLoadEnd = useCallback(
    (url: string) => {
      const state = useBrowserStore.getState();

      if (isBrowserHomeUrl(state.currentUrl)) {
        setLoading(false);
        setProgress(0);
        return;
      }
      if (url === 'about:blank') {
        return;
      }

      // Stale completion from a superseded navigation — do not clear the active load.
      if (isStaleEvent()) {
        return;
      }

      if (state.isLoading && url !== state.currentUrl) {
        return;
      }

      setLoading(false);
      setProgress(1);
      if (url === state.currentUrl) {
        markVisited();

        if (!state.error && !state.incognito) {
          browserSyncService.onSuccessfulPage(state.currentUrl, state.pageTitle);

          // History recording lives outside BrowserContainer — fire after a successful load.
          void recordSuccessfulVisit({
            url: state.currentUrl,
            title: state.pageTitle,
            hasError: false,
          }).then((entry) => {
            if (entry) {
              useHistoryStore.getState().prependOrUpdate(entry);
              browserSyncService.invalidateSuggestionIntelligence();
            }
          });

          // Scroll restore only after a successful, fully loaded document.
          scrollPositionService.scheduleRestore({
            webView: webViewRef.current,
            url: state.currentUrl,
            epoch: navigationEpochRef.current,
          });
        }
      }
    },
    [
      isStaleEvent,
      markVisited,
      navigationEpochRef,
      setLoading,
      setProgress,
      webViewRef,
    ],
  );

  const onLoadProgress = useCallback(
    (event: WebViewProgressEvent) => {
      if (isBrowserHomeUrl(useBrowserStore.getState().currentUrl)) {
        return;
      }
      if (isStaleEvent()) {
        return;
      }

      const raw = event.nativeEvent.progress;
      // Always publish near-complete ticks so the bar can finish smoothly.
      if (raw >= 0.99) {
        lastProgressWriteAtRef.current = Date.now();
        lastProgressValueRef.current = raw;
        setProgress(raw);
        return;
      }

      const now = Date.now();
      const elapsed = now - lastProgressWriteAtRef.current;
      const delta = raw - lastProgressValueRef.current;
      // Coalesce micro-updates: keep visual smoothness without flooding subscribers.
      if (elapsed < 50 && delta < 0.02) {
        return;
      }

      lastProgressWriteAtRef.current = now;
      lastProgressValueRef.current = raw;
      setProgress(raw);
    },
    [isStaleEvent, setProgress],
  );

  const onError = useCallback(
    (event: WebViewErrorEvent) => {
      if (isBrowserHomeUrl(useBrowserStore.getState().currentUrl)) {
        return;
      }
      if (isStaleEvent()) {
        return;
      }
      const { description, url, code } = event.nativeEvent;
      setError(
        classifyWebViewLoadError({
          description: description || `Failed to load page (${code})`,
          code,
          url: url || null,
        }),
      );
      browserSyncService.onError();
    },
    [isStaleEvent, setError],
  );

  const onHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      const state = useBrowserStore.getState();
      if (isBrowserHomeUrl(state.currentUrl)) {
        return;
      }
      if (isStaleEvent()) {
        return;
      }
      const { statusCode, url, description } = event.nativeEvent;
      if (statusCode < 400) {
        return;
      }

      // Ignore subresource HTTP errors (favicon, ads, CDN) — only fail the active document.
      const errorUrl = typeof url === 'string' ? url.trim() : '';
      if (!errorUrl || !isSameDocumentNavigationUrl(errorUrl, state.currentUrl)) {
        return;
      }

      setError(
        createBrowserError('http_error', {
          message: description || `The website returned HTTP ${statusCode}.`,
          url: errorUrl || null,
          statusCode,
        }),
      );
      browserSyncService.onError();
    },
    [isStaleEvent, setError],
  );

  const recoverFromProcessTermination = useCallback(() => {
    const url = useBrowserStore.getState().currentUrl;
    clearError();
    if (isBrowserHomeUrl(url)) {
      goHome();
      return;
    }
    loadUrl(url);
  }, [clearError, goHome, loadUrl]);

  const onContentProcessDidTerminate = useCallback(
    (_event: WebViewTerminatedEvent) => {
      recoverFromProcessTermination();
    },
    [recoverFromProcessTermination],
  );

  const onRenderProcessGone = useCallback(
    (_event: WebViewRenderProcessGoneEvent) => {
      recoverFromProcessTermination();
    },
    [recoverFromProcessTermination],
  );

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    const { url } = request;

    if (!url || url === 'about:blank') {
      return true;
    }

    if (isBrowserHomeUrl(url)) {
      return false;
    }

    // Passive media observation — never changes allow/deny policy.
    // Cheap extension pre-filter avoids pipeline work for non-media navigations.
    const pageUrl = useBrowserStore.getState().currentUrl;
    if (
      !isBrowserHomeUrl(pageUrl) &&
      /\.(mp4|webm|mov|m4v|mp3|m4a|aac|ogg|m3u8)(?:[?#]|$)/i.test(url)
    ) {
      mediaDetectionEngine.observeUrl(url, pageUrl);
    }

    if (!navigationService.shouldHandleInBrowser(url)) {
      if (navigationService.classify(url).kind !== 'blocked') {
        void navigationService.openExternal(url);
      }
      return false;
    }

    return true;
  }, []);

  return useMemo(
    () => ({
      onNavigationStateChange,
      onLoadStart,
      onLoadEnd,
      onLoadProgress,
      onError,
      onHttpError,
      onContentProcessDidTerminate,
      onRenderProcessGone,
      onShouldStartLoadWithRequest,
    }),
    [
      onNavigationStateChange,
      onLoadStart,
      onLoadEnd,
      onLoadProgress,
      onError,
      onHttpError,
      onContentProcessDidTerminate,
      onRenderProcessGone,
      onShouldStartLoadWithRequest,
    ],
  );
}

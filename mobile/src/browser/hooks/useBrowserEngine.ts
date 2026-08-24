import { useCallback, useMemo, useRef, useState } from 'react';
import type WebView from 'react-native-webview';

import { BROWSER_WEBVIEW_BLANK } from '@/browser/constants';
import type { BrowserEngineContextValue, ChromeNavState } from '@/browser/engine';
import {
  blankWebView,
  browserSyncService,
  goBackWebView,
  goForwardWebView,
  navigationService,
  reloadWebView,
  stopWebViewLoading,
} from '@/browser/services';
import { useBrowserStore } from '@/browser/stores';
import { isBlockedScheme, isBrowserHomeUrl, isExternalScheme } from '@/browser/utils';

type WebViewWithHistory = WebView & {
  clearHistory?: () => void;
};

/**
 * Owns the WebView ref, chrome-initiated source URI, and imperative commands.
 * Mount once at the BrowserScreen root and provide via BrowserEngineProvider.
 *
 * Chrome (omnibox) navigations update `sourceUri` so Android maintains a real
 * native history stack. A parallel chrome stack is kept as fallback when the
 * WebView reports canGoBack=false incorrectly after JS-driven loads.
 */
export function useBrowserEngine(): BrowserEngineContextValue {
  const webViewRef = useRef<WebView | null>(null);
  /** Bumped on every chrome-initiated navigation to ignore stale WebView events. */
  const navigationEpochRef = useRef(0);
  /** Omnibox navigation stack — fallback when native canGoBack is wrong. */
  const chromeNavRef = useRef<ChromeNavState>({ stack: [], index: -1 });
  /** Last canGoBack/canGoForward reported by the WebView itself. */
  const nativeCanGoBackRef = useRef(false);
  const nativeCanGoForwardRef = useRef(false);

  const [sourceUri, setSourceUri] = useState(() => {
    const url = useBrowserStore.getState().currentUrl;
    return isBrowserHomeUrl(url) ? BROWSER_WEBVIEW_BLANK : url || BROWSER_WEBVIEW_BLANK;
  });

  const setCurrentUrl = useBrowserStore((state) => state.setCurrentUrl);
  const setLoading = useBrowserStore((state) => state.setLoading);
  const setProgress = useBrowserStore((state) => state.setProgress);
  const clearError = useBrowserStore((state) => state.clearError);
  const goHomeAction = useBrowserStore((state) => state.goHome);

  const bumpNavigationEpoch = useCallback(() => {
    navigationEpochRef.current += 1;
    return navigationEpochRef.current;
  }, []);

  const publishChromeHistoryFlags = useCallback(() => {
    const { index, stack } = chromeNavRef.current;
    useBrowserStore.setState({
      canGoBack: nativeCanGoBackRef.current || index > 0,
      canGoForward:
        nativeCanGoForwardRef.current ||
        (index >= 0 && index < stack.length - 1),
    });
  }, []);

  const goHome = useCallback(() => {
    bumpNavigationEpoch();
    chromeNavRef.current = { stack: [], index: -1 };
    nativeCanGoBackRef.current = false;
    nativeCanGoForwardRef.current = false;
    setSourceUri(BROWSER_WEBVIEW_BLANK);
    blankWebView(webViewRef.current);
    const webView = webViewRef.current as WebViewWithHistory | null;
    webView?.clearHistory?.();
    goHomeAction();
    browserSyncService.onGoHome();
  }, [bumpNavigationEpoch, goHomeAction]);

  const goBack = useCallback(() => {
    // Prefer real WebView history (in-page links, redirects, native loads).
    if (nativeCanGoBackRef.current) {
      goBackWebView(webViewRef.current);
      return;
    }

    const chrome = chromeNavRef.current;
    if (chrome.index > 0) {
      chrome.index -= 1;
      const url = chrome.stack[chrome.index]!;
      bumpNavigationEpoch();
      clearError();
      setCurrentUrl(url);
      setLoading(true);
      setProgress(0.02);
      setSourceUri(url);
      nativeCanGoForwardRef.current = true;
      publishChromeHistoryFlags();
      browserSyncService.onNavigate(url);
      return;
    }

    if (!isBrowserHomeUrl(useBrowserStore.getState().currentUrl)) {
      goHome();
    }
  }, [
    bumpNavigationEpoch,
    clearError,
    goHome,
    publishChromeHistoryFlags,
    setCurrentUrl,
    setLoading,
    setProgress,
  ]);

  const goForward = useCallback(() => {
    if (nativeCanGoForwardRef.current) {
      goForwardWebView(webViewRef.current);
      return;
    }

    const chrome = chromeNavRef.current;
    if (chrome.index >= 0 && chrome.index < chrome.stack.length - 1) {
      chrome.index += 1;
      const url = chrome.stack[chrome.index]!;
      bumpNavigationEpoch();
      clearError();
      setCurrentUrl(url);
      setLoading(true);
      setProgress(0.02);
      setSourceUri(url);
      nativeCanGoBackRef.current = chrome.index > 0;
      publishChromeHistoryFlags();
      browserSyncService.onNavigate(url);
    }
  }, [
    bumpNavigationEpoch,
    clearError,
    publishChromeHistoryFlags,
    setCurrentUrl,
    setLoading,
    setProgress,
  ]);

  const reload = useCallback(() => {
    if (isBrowserHomeUrl(useBrowserStore.getState().currentUrl)) {
      return;
    }
    if (useBrowserStore.getState().isLoading) {
      return;
    }
    bumpNavigationEpoch();
    clearError();
    setLoading(true);
    reloadWebView(webViewRef.current);
  }, [bumpNavigationEpoch, clearError, setLoading]);

  const stopLoading = useCallback(() => {
    stopWebViewLoading(webViewRef.current);
    setLoading(false);
  }, [setLoading]);

  const loadUrl = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        return;
      }

      if (isBrowserHomeUrl(trimmed)) {
        goHome();
        return;
      }

      if (!navigationService.shouldHandleInBrowser(trimmed)) {
        if (isExternalScheme(trimmed) && !isBlockedScheme(trimmed)) {
          void navigationService.openExternal(trimmed);
        }
        return;
      }

      const previousUrl = useBrowserStore.getState().currentUrl;
      const wasHome = isBrowserHomeUrl(previousUrl);

      if (!wasHome && previousUrl === trimmed) {
        bumpNavigationEpoch();
        clearError();
        setLoading(true);
        reloadWebView(webViewRef.current);
        return;
      }

      // Truncate any forward entries, then push this chrome navigation.
      const chrome = chromeNavRef.current;
      const nextStack = chrome.stack.slice(0, chrome.index + 1);
      nextStack.push(trimmed);
      chrome.stack = nextStack;
      chrome.index = nextStack.length - 1;
      nativeCanGoForwardRef.current = false;

      bumpNavigationEpoch();
      clearError();
      setCurrentUrl(trimmed);
      setLoading(true);
      setProgress(0.02);
      browserSyncService.onNavigate(trimmed);

      // Native source load — reliable Android history vs injectJavaScript assign.
      setSourceUri(trimmed);
      publishChromeHistoryFlags();
    },
    [
      bumpNavigationEpoch,
      clearError,
      goHome,
      publishChromeHistoryFlags,
      setCurrentUrl,
      setLoading,
      setProgress,
    ],
  );

  return useMemo(
    () => ({
      webViewRef,
      sourceUri,
      navigationEpochRef,
      chromeNavRef,
      nativeCanGoBackRef,
      nativeCanGoForwardRef,
      publishChromeHistoryFlags,
      goBack,
      goForward,
      reload,
      stopLoading,
      loadUrl,
      goHome,
    }),
    [
      sourceUri,
      publishChromeHistoryFlags,
      goBack,
      goForward,
      reload,
      stopLoading,
      loadUrl,
      goHome,
    ],
  );
}

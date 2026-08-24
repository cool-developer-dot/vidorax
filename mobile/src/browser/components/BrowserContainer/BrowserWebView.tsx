import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewNavigationEvent,
  WebViewProgressEvent,
  WebViewRenderProcessGoneEvent,
  WebViewTerminatedEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { useTheme } from '@/hooks/use-theme';
import { useMediaDetectionBridge } from '@/media-detection';
import { useTranslation } from '@/localization';

import type { BrowserChromeBridgeBindings } from '@/browser/hooks';
import { buildBrowserUserAgent } from '@/browser/constants';
import { useBrowserEngineContext } from '@/browser/engine';
import { useBrowserEngineEvents } from '@/browser/hooks';
import { useBrowserStore } from '@/browser/stores';
import { isBrowserHomeUrl } from '@/browser/utils';

export type BrowserWebViewProps = {
  testID?: string;
  chromeBridge: BrowserChromeBridgeBindings;
};

function computePullToRefreshEnabled(state: {
  currentUrl: string;
  isLoading: boolean;
  error: unknown;
}): boolean {
  return !isBrowserHomeUrl(state.currentUrl) && !state.isLoading && state.error == null;
}

/**
 * Thin WebView host. Renders and reports events only — no domain logic.
 * Media detection + browser chrome are passive observers (inject + onMessage).
 */
export const BrowserWebView = memo(function BrowserWebView({
  testID = 'browser-webview',
  chromeBridge,
}: BrowserWebViewProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { webViewRef, sourceUri } = useBrowserEngineContext();
  const {
    onNavigationStateChange,
    onLoadStart,
    onLoadEnd,
    onLoadProgress,
    onError,
    onHttpError,
    onContentProcessDidTerminate,
    onRenderProcessGone,
    onShouldStartLoadWithRequest,
  } = useBrowserEngineEvents();
  const {
    injectedJavaScript: mediaInjected,
    injectedJavaScriptBeforeContentLoaded: mediaBeforeContent,
    onMessage: onMediaDetectionMessage,
  } = useMediaDetectionBridge();

  /**
   * Subscribe only to the derived pull-to-refresh flag so progress / title
   * chatter never re-renders this WebView host.
   */
  const [pullToRefreshEnabled, setPullToRefreshEnabled] = useState(() =>
    computePullToRefreshEnabled(useBrowserStore.getState()),
  );

  useEffect(() => {
    return useBrowserStore.subscribe((state) => {
      const next = computePullToRefreshEnabled(state);
      setPullToRefreshEnabled((prev) => (prev === next ? prev : next));
    });
  }, []);

  const userAgent = useMemo(() => buildBrowserUserAgent(), []);

  const injectedJavaScript = useMemo(
    () => `${chromeBridge.injectedJavaScript}\n${mediaInjected}`,
    [chromeBridge.injectedJavaScript, mediaInjected],
  );

  const injectedJavaScriptBeforeContentLoaded = useMemo(
    () =>
      `${chromeBridge.injectedJavaScriptBeforeContentLoaded}\n${mediaBeforeContent}`,
    [chromeBridge.injectedJavaScriptBeforeContentLoaded, mediaBeforeContent],
  );

  const handleLoadStart = useCallback(
    (event: WebViewNavigationEvent | WebViewErrorEvent) => {
      onLoadStart(event.nativeEvent.url);
    },
    [onLoadStart],
  );

  const handleLoadEnd = useCallback(
    (event: WebViewNavigationEvent | WebViewErrorEvent) => {
      onLoadEnd(event.nativeEvent.url);
    },
    [onLoadEnd],
  );

  const handleProgress = useCallback(
    (event: WebViewProgressEvent) => {
      onLoadProgress(event);
    },
    [onLoadProgress],
  );

  const handleError = useCallback(
    (event: WebViewErrorEvent) => {
      onError(event);
    },
    [onError],
  );

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      onHttpError(event);
    },
    [onHttpError],
  );

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      onNavigationStateChange(navState);
    },
    [onNavigationStateChange],
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => onShouldStartLoadWithRequest(request),
    [onShouldStartLoadWithRequest],
  );

  const handleContentProcessDidTerminate = useCallback(
    (event: WebViewTerminatedEvent) => {
      onContentProcessDidTerminate(event);
    },
    [onContentProcessDidTerminate],
  );

  const handleRenderProcessGone = useCallback(
    (event: WebViewRenderProcessGoneEvent) => {
      onRenderProcessGone(event);
    },
    [onRenderProcessGone],
  );

  const handleOpenWindow = useCallback(() => {
    // Block popup / target=_blank window creation — single-document browser surface.
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      // Demux: browser chrome channel first, then media detection.
      if (chromeBridge.handleChromeMessage(raw)) {
        return;
      }
      onMediaDetectionMessage(raw);
    },
    [chromeBridge, onMediaDetectionMessage],
  );

  return (
    <WebView
      ref={webViewRef}
      testID={testID}
      source={{ uri: sourceUri }}
      style={[styles.webview, { backgroundColor: theme.colors.background }]}
      userAgent={userAgent}
      applicationNameForUserAgent="VidoraXBrowser"
      javaScriptEnabled
      domStorageEnabled
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
      cacheEnabled
      originWhitelist={['http://*', 'https://*']}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never"
      geolocationEnabled={false}
      allowsBackForwardNavigationGestures
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      setSupportMultipleWindows={false}
      startInLoadingState={false}
      pullToRefreshEnabled={pullToRefreshEnabled}
      injectedJavaScript={injectedJavaScript}
      injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
      onMessage={handleMessage}
      onNavigationStateChange={handleNavigationStateChange}
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
      onLoadProgress={handleProgress}
      onError={handleError}
      onHttpError={handleHttpError}
      onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
      onContentProcessDidTerminate={handleContentProcessDidTerminate}
      onRenderProcessGone={handleRenderProcessGone}
      onOpenWindow={handleOpenWindow}
      accessibilityLabel={t('browser.webContentA11y')}
      accessibilityHint={
        pullToRefreshEnabled
          ? t('browser.pullToRefreshHint')
          : useBrowserStore.getState().isLoading
            ? t('browser.pageLoadingHint')
            : undefined
      }
      accessibilityRole="none"
      accessible
    />
  );
});

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
});

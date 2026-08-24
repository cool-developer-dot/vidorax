import { memo, useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { Box } from '@/components/base/Box';

import { BrowserErrorView } from '@/browser/components/BrowserErrorView';
import { BrowserHomeView } from '@/browser/components/BrowserHome';
import { BrowserLinkActionSheet } from '@/browser/components/BrowserLinkActionSheet';
import { useBrowserEngineContext } from '@/browser/engine';
import {
  useBrowserChromeBridge,
  useBrowserLongPressActions,
} from '@/browser/hooks';
import { selectIsHome, useBrowserStore } from '@/browser/stores';

import { BrowserWebView } from './BrowserWebView';

export type BrowserContainerProps = {
  testID?: string;
};

/**
 * WebView rendering surface + home landing + interaction overlays.
 * Responsibilities: render content, report events, host long-press sheet.
 * Never owns media parsing, history persistence, or downloads —
 * those hang off the WebView event/bridge adapters as passive observers.
 */
export const BrowserContainer = memo(function BrowserContainer({
  testID = 'browser-container',
}: BrowserContainerProps) {
  const isHome = useBrowserStore(selectIsHome);
  const { reload, stopLoading } = useBrowserEngineContext();
  const longPress = useBrowserLongPressActions();
  const lastPullAtRef = useRef(0);

  const onPullToRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastPullAtRef.current < 1000) {
      return;
    }
    lastPullAtRef.current = now;

    // Recover from a stuck isLoading latch so pull-to-refresh still works.
    if (useBrowserStore.getState().isLoading) {
      stopLoading();
    }
    reload();
  }, [reload, stopLoading]);

  const chromeBridge = useBrowserChromeBridge({
    onLinkLongPress: longPress.present,
    onPullToRefresh,
  });

  return (
    <Box testID={testID} flex={1} style={{ position: 'relative' }}>
      <Box
        flex={1}
        style={isHome ? styles.hiddenWebView : styles.visibleWebView}
        pointerEvents={isHome ? 'none' : 'auto'}
        importantForAccessibility={isHome ? 'no-hide-descendants' : 'yes'}>
        <BrowserWebView chromeBridge={chromeBridge} />
      </Box>

      {isHome ? <BrowserHomeView /> : null}
      {!isHome ? <BrowserErrorView /> : null}

      <BrowserLinkActionSheet
        visible={longPress.visible}
        title={longPress.title}
        subtitle={longPress.subtitle}
        actions={longPress.actions}
        onClose={longPress.dismiss}
      />
    </Box>
  );
});

const styles = StyleSheet.create({
  visibleWebView: {
    ...StyleSheet.absoluteFill,
    opacity: 1,
    zIndex: 0,
  },
  hiddenWebView: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
    zIndex: 0,
  },
});

import { useCallback, useMemo } from 'react';

import {
  buildBrowserChromeBeforeContentScript,
  buildBrowserChromeInjectedScript,
  parseBrowserChromeMessage,
} from '@/browser/bridge';
import type { BrowserLinkLongPressPayload } from '@/browser/actions';
import { browserSyncService } from '@/browser/services/browser-sync.service';
import { useBrowserStore } from '@/browser/stores';
import { isBrowserHomeUrl } from '@/browser/utils';

export type BrowserChromeBridgeBindings = {
  injectedJavaScript: string;
  injectedJavaScriptBeforeContentLoaded: string;
  handleChromeMessage: (raw: string) => boolean;
};

type UseBrowserChromeBridgeOptions = {
  onLinkLongPress: (payload: BrowserLinkLongPressPayload) => void;
  /** Android-oriented pull-to-refresh (RN WebView prop is iOS-only). */
  onPullToRefresh?: () => void;
};

/**
 * Browser chrome WebView bridge (long-press + scroll + pull-to-refresh).
 * Returns whether a message was consumed so media detection can demux.
 */
export function useBrowserChromeBridge(
  options: UseBrowserChromeBridgeOptions,
): BrowserChromeBridgeBindings {
  const { onLinkLongPress, onPullToRefresh } = options;

  const injectedJavaScript = useMemo(
    () => buildBrowserChromeInjectedScript(),
    [],
  );

  const injectedJavaScriptBeforeContentLoaded = useMemo(
    () => buildBrowserChromeBeforeContentScript(),
    [],
  );

  const handleChromeMessage = useCallback(
    (raw: string): boolean => {
      const message = parseBrowserChromeMessage(raw);
      if (!message) {
        return false;
      }

      switch (message.type) {
        case 'ready':
          return true;
        case 'scroll': {
          const state = useBrowserStore.getState();
          if (isBrowserHomeUrl(state.currentUrl) || state.isLoading) {
            return true;
          }
          browserSyncService.onScroll(state.currentUrl, message.payload.scrollY);
          return true;
        }
        case 'link_long_press': {
          onLinkLongPress(message.payload);
          return true;
        }
        case 'pull_to_refresh': {
          const state = useBrowserStore.getState();
          if (isBrowserHomeUrl(state.currentUrl) || state.error != null) {
            return true;
          }
          onPullToRefresh?.();
          return true;
        }
        default:
          return true;
      }
    },
    [onLinkLongPress, onPullToRefresh],
  );

  return useMemo(
    () => ({
      injectedJavaScript,
      injectedJavaScriptBeforeContentLoaded,
      handleChromeMessage,
    }),
    [
      injectedJavaScript,
      injectedJavaScriptBeforeContentLoaded,
      handleChromeMessage,
    ],
  );
}

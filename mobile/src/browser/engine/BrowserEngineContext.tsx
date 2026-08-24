import {
  createContext,
  useContext,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';
import type WebView from 'react-native-webview';

import type { BrowserEngineCommands } from '@/browser/types';

export type ChromeNavState = {
  stack: string[];
  index: number;
};

export interface BrowserEngineContextValue extends BrowserEngineCommands {
  webViewRef: RefObject<WebView | null>;
  /** Live URI bound to the WebView `source` prop (chrome navigations + home blank). */
  sourceUri: string;
  /** Chrome navigation epoch — event handlers ignore stale completions. */
  navigationEpochRef: MutableRefObject<number>;
  /** Omnibox navigation stack used when native history flags are wrong. */
  chromeNavRef: MutableRefObject<ChromeNavState>;
  /** Last canGoBack reported by the WebView (not chrome-merged). */
  nativeCanGoBackRef: MutableRefObject<boolean>;
  /** Last canGoForward reported by the WebView (not chrome-merged). */
  nativeCanGoForwardRef: MutableRefObject<boolean>;
  /** Recompute store canGoBack/canGoForward from native + chrome stack. */
  publishChromeHistoryFlags: () => void;
}

const BrowserEngineContext = createContext<BrowserEngineContextValue | null>(null);

export type BrowserEngineProviderProps = {
  value: BrowserEngineContextValue;
  children: ReactNode;
};

export function BrowserEngineProvider({ value, children }: BrowserEngineProviderProps) {
  return (
    <BrowserEngineContext.Provider value={value}>{children}</BrowserEngineContext.Provider>
  );
}

export function useBrowserEngineContext(): BrowserEngineContextValue {
  const context = useContext(BrowserEngineContext);

  if (!context) {
    throw new Error('useBrowserEngineContext must be used within BrowserEngineProvider');
  }

  return context;
}

import { isBrowserHomeUrl } from '@/browser/utils';

import type { BrowserStore } from './types';

export const selectCurrentUrl = (state: BrowserStore) => state.currentUrl;
export const selectPageTitle = (state: BrowserStore) => state.pageTitle;
export const selectCanGoBack = (state: BrowserStore) => state.canGoBack;
export const selectCanGoForward = (state: BrowserStore) => state.canGoForward;
export const selectIsLoading = (state: BrowserStore) => state.isLoading;
export const selectProgress = (state: BrowserStore) => state.progress;
export const selectIsSecure = (state: BrowserStore) => state.isSecure;
export const selectSecurityLevel = (state: BrowserStore) => state.securityLevel;
export const selectLastVisited = (state: BrowserStore) => state.lastVisited;
export const selectBrowserError = (state: BrowserStore) => state.error;

export const selectIsHome = (state: BrowserStore) => isBrowserHomeUrl(state.currentUrl);

/**
 * Composite chrome snapshot.
 * Prefer atomic selectors in components. If used with `useBrowserStore`,
 * wrap with `useShallow` from `zustand/react/shallow` to avoid extra renders.
 */
export const selectNavigationChrome = (state: BrowserStore) => ({
  canGoBack: state.canGoBack,
  canGoForward: state.canGoForward,
  isLoading: state.isLoading,
  isHome: selectIsHome(state),
});

/**
 * Composite address-bar snapshot.
 * Prefer atomic selectors in components. If used with `useBrowserStore`,
 * wrap with `useShallow` from `zustand/react/shallow` to avoid extra renders.
 */
export const selectAddressBarState = (state: BrowserStore) => ({
  currentUrl: state.currentUrl,
  isSecure: state.isSecure,
  securityLevel: state.securityLevel,
  isLoading: state.isLoading,
  pageTitle: state.pageTitle,
  isHome: selectIsHome(state),
});

import type { StoreApi } from 'zustand';

import { getSecurityLevel, isBrowserHomeUrl, isSecureUrl } from '@/browser/utils';
import { normalizeLoadProgress } from '@/browser/utils/progress';

import { initialBrowserState } from './state';
import type { BrowserActions, BrowserStore } from './types';

function securityFields(url: string) {
  return {
    isSecure: isSecureUrl(url),
    securityLevel: getSecurityLevel(url),
  };
}

export function createBrowserActions(
  set: StoreApi<BrowserStore>['setState'],
  get: StoreApi<BrowserStore>['getState'],
): BrowserActions {
  return {
    applyNavigationState: (snapshot) => {
      // Ignore blank / internal noise while home surface is active.
      if (isBrowserHomeUrl(get().currentUrl) && snapshot.url === 'about:blank') {
        return;
      }

      const url = isBrowserHomeUrl(snapshot.url) ? get().currentUrl : snapshot.url;

      set({
        currentUrl: url,
        pageTitle: snapshot.title || get().pageTitle,
        canGoBack: snapshot.canGoBack,
        canGoForward: snapshot.canGoForward,
        isLoading: snapshot.loading,
        ...securityFields(url),
        error: snapshot.loading ? null : get().error,
      });
    },

    setLoading: (isLoading) => {
      set((state) => ({
        isLoading,
        progress: isLoading
          ? normalizeLoadProgress(state.progress, true, state.progress)
          : state.progress,
        error: isLoading ? null : state.error,
      }));
    },

    setProgress: (progress) => {
      set((state) => ({
        progress: normalizeLoadProgress(progress, state.isLoading, state.progress),
      }));
    },

    setPageTitle: (title) => {
      set({ pageTitle: title });
    },

    setCurrentUrl: (url) => {
      set({
        currentUrl: url,
        ...securityFields(url),
      });
    },

    goHome: () => {
      set({
        currentUrl: initialBrowserState.currentUrl,
        pageTitle: '',
        isLoading: false,
        progress: 0,
        canGoBack: false,
        canGoForward: false,
        error: null,
        ...securityFields(initialBrowserState.currentUrl),
      });
    },

    setError: (error) => {
      set({
        error,
        isLoading: false,
        progress: 0,
      });
    },

    clearError: () => {
      set({ error: null });
    },

    markVisited: (timestamp = Date.now()) => {
      set({ lastVisited: timestamp });
    },

    resetSession: () => {
      const { tabs, downloads, history, bookmarks, readerMode, incognito, desktopMode } =
        get();
      set({
        ...initialBrowserState,
        tabs,
        downloads,
        history,
        bookmarks,
        readerMode,
        incognito,
        desktopMode,
      });
    },

    reset: () => {
      set(initialBrowserState);
    },
  };
}

import { BROWSER_HOMEPAGE } from '@/browser/constants';
import {
  readBrowserSessionSync,
  resolveRestorableSessionUrl,
} from '@/browser/session';
import { scrollPositionService } from '@/browser/scroll';
import type { BrowserSessionState, BrowserState } from '@/browser/types';
import { getSecurityLevel, isSecureUrl } from '@/browser/utils';

export const initialBrowserSessionState: BrowserSessionState = {
  currentUrl: BROWSER_HOMEPAGE,
  pageTitle: '',
  canGoBack: false,
  canGoForward: false,
  isLoading: false,
  progress: 0,
  isSecure: true,
  securityLevel: getSecurityLevel(BROWSER_HOMEPAGE),
  lastVisited: null,
  error: null,
};

export const initialBrowserExtensionState = {
  tabs: [] as never[],
  downloads: [] as never[],
  history: [] as never[],
  bookmarks: [] as never[],
  readerMode: false as const,
  incognito: false as const,
  desktopMode: false as const,
};

/**
 * Cold-start continuity: seed session chrome from durable storage when available.
 * MMKV path is synchronous — avoids home→page flicker on native builds.
 */
function resolveHydratedSessionState(): BrowserSessionState {
  try {
    const session = readBrowserSessionSync();
    const restorable = resolveRestorableSessionUrl(session);
    if (!restorable) {
      return initialBrowserSessionState;
    }

    scrollPositionService.hydrateFromPersisted(session?.scrollPositions);
    scrollPositionService.seed(restorable.url, restorable.scrollY);

    return {
      ...initialBrowserSessionState,
      currentUrl: restorable.url,
      pageTitle: restorable.title,
      isSecure: isSecureUrl(restorable.url),
      securityLevel: getSecurityLevel(restorable.url),
    };
  } catch {
    return initialBrowserSessionState;
  }
}

export const initialBrowserState: BrowserState = {
  ...resolveHydratedSessionState(),
  ...initialBrowserExtensionState,
};

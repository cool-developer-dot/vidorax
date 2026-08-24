import type {
  BrowserErrorCode,
  BrowserErrorState,
  BrowserSecurityLevel,
} from './navigation.types';

export type {
  BrowserErrorCode,
  BrowserErrorState,
  BrowserSecurityLevel,
  NavigationInputCategory,
  NavigationIntent,
} from './navigation.types';

/**
 * Core browser session state for the active browsing surface.
 *
 * Extensibility: future domains (tabs, downloads, history, bookmarks,
 * readerMode, incognito) attach as sibling slices — never mutate these
 * core fields' semantics.
 */
export interface BrowserSessionState {
  currentUrl: string;
  pageTitle: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  /** Normalized 0–1 page load progress. */
  progress: number;
  isSecure: boolean;
  securityLevel: BrowserSecurityLevel;
  /** Epoch ms of last successful navigation commit. */
  lastVisited: number | null;
  error: BrowserErrorState | null;
}

/**
 * Reserved extension surface. Populated by future phases without
 * restructuring the core store.
 */
export interface BrowserExtensionState {
  tabs: never[];
  downloads: never[];
  history: never[];
  bookmarks: never[];
  readerMode: false;
  incognito: false;
  desktopMode: false;
}

export type BrowserState = BrowserSessionState & BrowserExtensionState;

export interface BrowserNavigationSnapshot {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
}

export interface BrowserProgressEvent {
  progress: number;
}

export interface BrowserTitleEvent {
  title: string;
}

export interface BrowserLoadErrorEvent {
  code: BrowserErrorCode;
  message: string;
  url: string | null;
  statusCode?: number;
}

/**
 * Future omnibox / chrome action IDs.
 * Wired as extension points only — no behavior in this phase.
 */
export type BrowserChromeActionId =
  | 'share'
  | 'open_external'
  | 'copy_link'
  | 'reader_mode'
  | 'translate'
  | 'desktop_site'
  | 'ai_assistant'
  | 'qr_code'
  | 'downloads'
  | 'bookmarks'
  | 'history';

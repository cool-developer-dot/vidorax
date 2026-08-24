export {
  clearPersistedBrowserSession,
  flushBrowserSessionPersistence,
  getCachedBrowserSession,
  getPersistedScrollForUrl,
  isRestorableBrowserUrl,
  persistBrowserSession,
  readBrowserSession,
  readBrowserSessionSync,
  resolveRestorableSessionUrl,
  updatePersistedScrollPosition,
} from './session-persistence.service';
export type {
  BrowserSessionSnapshotInput,
  PersistedBrowserSession,
} from './session.types';

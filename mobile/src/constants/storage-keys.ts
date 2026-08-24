export const storageKeys = {
  auth: 'vidorax.auth',
  authToken: 'vidorax.auth.token',
  refreshToken: 'vidorax.auth.refreshToken',
  /** Slim profile JSON for offline session restore (SecureStore). */
  profileSnapshot: 'vidorax.auth.profileSnapshot',
  app: 'vidorax.app',
  userPreferences: 'vidorax.user.preferences',
  themePreference: 'vidorax.user.themePreference',
  downloadQueue: 'vidorax.downloads.queue',
  onboardingComplete: 'vidorax.app.onboardingComplete',
  /** Local SQLite database file name (not a key-value persist key). */
  localDatabase: 'vidorax.db',
  /** Cached logical folder metadata for offline folder filtering. */
  mediaFolders: 'vidorax.org.media.folders',
  /** Persisted mediaId->folderId assignments for offline folder organization. */
  mediaFolderAssignments: 'vidorax.org.media.folderAssignments',
} as const;

export type StorageKey = (typeof storageKeys)[keyof typeof storageKeys];

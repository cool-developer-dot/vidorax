export const DATABASE_NAME = 'vidorax.db';

export const DATABASE_VERSION = 1;

export const TABLE_NAMES = {
  browserHistory: 'browser_history',
  bookmarks: 'bookmarks',
  recentSearches: 'recent_searches',
  recentUrls: 'recent_urls',
} as const;

export const RECENT_SEARCH_LIMIT = 50;

export const RECENT_URL_LIMIT = 50;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];

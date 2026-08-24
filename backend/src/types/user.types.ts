import type { ThemeMode } from '@prisma/client';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileInput {
  name?: string;
}

export interface UserSettingsResponse {
  theme: ThemeMode;
  language: string;
  notificationsEnabled: boolean;
  wifiOnlyDownloads: boolean;
  autoResumeDownloads: boolean;
  downloadDirectory: string;
}

export interface UpdateSettingsInput {
  theme?: ThemeMode;
  language?: string;
  notificationsEnabled?: boolean;
  wifiOnlyDownloads?: boolean;
  autoResumeDownloads?: boolean;
  downloadDirectory?: string;
}

export interface BrowserHistoryItem {
  id: string;
  url: string;
  title: string;
  hostname: string;
  visitedAt: Date;
  createdAt: Date;
}

export interface CreateHistoryInput {
  url: string;
  title: string;
  /** Optional client visit time (ISO parsed upstream). Defaults to server now. */
  visitedAt?: Date;
}

export interface RecentUrlItem {
  url: string;
  title: string;
  hostname: string;
  visitedAt: Date;
}

export interface BookmarkItem {
  id: string;
  url: string;
  title: string;
  hostname: string;
  faviconUrl: string | null;
  createdAt: Date;
}

export interface CreateBookmarkInput {
  url: string;
  title: string;
  faviconUrl?: string | null;
}

export interface UpdateBookmarkInput {
  url?: string;
  title?: string;
  faviconUrl?: string | null;
}

import {
  bookmarksApi,
  isApiError,
  type BookmarkItem,
  type BookmarkListSort,
} from '@/api';
import { selectIsAuthenticated, useAuthStore } from '@/store/auth';
import {
  bookmarkRepository,
  type BookmarkRepository,
} from '@/storage/repositories';
import type {
  BookmarkEntry,
  CreateBookmarkInput,
  ListBookmarksOptions,
  PaginatedResult,
  UpdateBookmarkInput,
} from '@/storage/types';
import { toStorageError } from '@/storage/types';

function mapRemoteItem(item: BookmarkItem): BookmarkEntry {
  const createdAt =
    typeof item.createdAt === 'string'
      ? item.createdAt
      : new Date(item.createdAt).toISOString();

  return {
    id: item.id,
    url: item.url,
    title: item.title,
    hostname: item.hostname,
    faviconUrl: item.faviconUrl,
    createdAt,
    updatedAt: createdAt,
  };
}

function toRemoteSort(
  sortBy: ListBookmarksOptions['sortBy'],
  sortDirection: ListBookmarksOptions['sortDirection'],
): BookmarkListSort {
  if (sortBy === 'title' || sortBy === 'hostname') {
    return 'alphabetical';
  }

  if (sortDirection === 'asc') {
    return 'oldest';
  }

  return 'newest';
}

function isAuthenticated(): boolean {
  return selectIsAuthenticated(useAuthStore.getState());
}

function shouldIgnoreSyncError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }

  return error.isNetworkError || error.isUnauthorized || error.code === 'SERVER_ERROR';
}

function buildFaviconUrl(hostname: string): string | null {
  const host = hostname.trim().toLowerCase();
  if (!host) {
    return null;
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

export class BookmarkService {
  private toggleInFlight = new Map<string, Promise<{ bookmarked: boolean; bookmark: BookmarkEntry | null }>>();

  constructor(private readonly bookmarkRepo: BookmarkRepository = bookmarkRepository) {}

  async add(input: CreateBookmarkInput): Promise<BookmarkEntry> {
    try {
      let hostname = input.hostname?.trim() || '';
      if (!hostname) {
        try {
          hostname = new URL(input.url).hostname;
        } catch {
          hostname = '';
        }
      }

      const entry = await this.bookmarkRepo.create({
        ...input,
        hostname: hostname || input.hostname,
        faviconUrl:
          input.faviconUrl !== undefined
            ? input.faviconUrl
            : buildFaviconUrl(hostname),
      });

      if (isAuthenticated()) {
        void this.syncAddToRemote(entry);
      }

      return entry;
    } catch (error) {
      throw toStorageError(error, 'Failed to add bookmark');
    }
  }

  private async syncAddToRemote(entry: BookmarkEntry): Promise<void> {
    try {
      const remote = await bookmarksApi.createBookmark({
        url: entry.url,
        title: entry.title,
        faviconUrl: entry.faviconUrl,
      });

      if (remote.id !== entry.id) {
        await this.bookmarkRepo.replaceId(entry.id, remote.id);
      } else {
        await this.bookmarkRepo.upsertRemote(mapRemoteItem(remote));
      }
    } catch (error) {
      if (!shouldIgnoreSyncError(error)) {
        // Local cache remains authoritative when remote sync fails.
      }
    }
  }

  async getById(id: string): Promise<BookmarkEntry | null> {
    return this.bookmarkRepo.findById(id);
  }

  async getByUrl(url: string): Promise<BookmarkEntry | null> {
    return this.bookmarkRepo.findByUrl(url);
  }

  async isBookmarked(url: string): Promise<boolean> {
    return this.bookmarkRepo.existsByUrl(url);
  }

  async list(options?: ListBookmarksOptions): Promise<PaginatedResult<BookmarkEntry>> {
    return this.bookmarkRepo.list(options);
  }

  async search(
    query: string,
    options?: Omit<ListBookmarksOptions, 'query'>,
  ): Promise<PaginatedResult<BookmarkEntry>> {
    return this.bookmarkRepo.search(query, options);
  }

  async syncFromRemote(
    options: ListBookmarksOptions = {},
    config?: { signal?: AbortSignal },
  ): Promise<PaginatedResult<BookmarkEntry> | null> {
    if (!isAuthenticated()) {
      return null;
    }

    try {
      const remote = await bookmarksApi.listBookmarks(
        {
          page: options.page,
          limit: options.pageSize,
          search: options.query,
          sort: toRemoteSort(options.sortBy, options.sortDirection),
        },
        { signal: config?.signal },
      );

      const items = remote.items.map(mapRemoteItem);
      await this.bookmarkRepo.upsertManyRemote(items);

      return {
        items,
        total: remote.pagination.total,
        page: remote.pagination.page,
        pageSize: remote.pagination.limit,
        totalPages: remote.pagination.totalPages,
        hasMore: remote.pagination.hasMore,
      };
    } catch (error) {
      if (shouldIgnoreSyncError(error) || (isApiError(error) && error.code === 'UNKNOWN')) {
        return null;
      }

      throw toStorageError(error, 'Failed to synchronize bookmarks');
    }
  }

  async update(id: string, input: UpdateBookmarkInput): Promise<BookmarkEntry> {
    const entry = await this.bookmarkRepo.update(id, input);

    if (isAuthenticated()) {
      try {
        await bookmarksApi.updateBookmark(id, {
          url: input.url,
          title: input.title,
          faviconUrl: input.faviconUrl,
        });
      } catch (error) {
        if (!shouldIgnoreSyncError(error)) {
          // Local update already applied.
        }
      }
    }

    return entry;
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.bookmarkRepo.delete(id);

    if (deleted && isAuthenticated()) {
      try {
        await bookmarksApi.deleteBookmark(id);
      } catch (error) {
        if (!shouldIgnoreSyncError(error)) {
          // Local delete already applied.
        }
      }
    }

    return deleted;
  }

  async removeByUrl(url: string): Promise<boolean> {
    const existing = await this.bookmarkRepo.findByUrl(url);

    if (!existing) {
      return false;
    }

    return this.remove(existing.id);
  }

  async removeMany(ids: string[]): Promise<number> {
    const deleted = await this.bookmarkRepo.deleteMany(ids);

    if (deleted > 0 && isAuthenticated()) {
      await Promise.allSettled(ids.map((id) => bookmarksApi.deleteBookmark(id)));
    }

    return deleted;
  }

  async clear(): Promise<number> {
    const deleted = await this.bookmarkRepo.clear();

    if (isAuthenticated()) {
      try {
        await bookmarksApi.clearBookmarks();
      } catch (error) {
        if (!shouldIgnoreSyncError(error)) {
          // Local clear already applied.
        }
      }
    }

    return deleted;
  }

  async toggle(input: CreateBookmarkInput): Promise<{
    bookmarked: boolean;
    bookmark: BookmarkEntry | null;
  }> {
    const urlKey = input.url.trim().toLowerCase();
    const existingTask = this.toggleInFlight.get(urlKey);

    if (existingTask) {
      return existingTask;
    }

    const task = this.performToggle(input).finally(() => {
      this.toggleInFlight.delete(urlKey);
    });

    this.toggleInFlight.set(urlKey, task);
    return task;
  }

  private async performToggle(input: CreateBookmarkInput): Promise<{
    bookmarked: boolean;
    bookmark: BookmarkEntry | null;
  }> {
    const existing = await this.bookmarkRepo.findByUrl(input.url);

    if (existing) {
      await this.remove(existing.id);
      return { bookmarked: false, bookmark: null };
    }

    const bookmark = await this.add(input);
    return { bookmarked: true, bookmark };
  }
}

export const bookmarkService = new BookmarkService();

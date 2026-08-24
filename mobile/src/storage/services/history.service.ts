import {
  historyApi,
  isApiError,
  type BrowserHistoryItem,
  type HistoryListSort,
} from '@/api';
import { selectIsAuthenticated, useAuthStore } from '@/store/auth';
import {
  historyRepository,
  recentUrlRepository,
  type HistoryRepository,
  type RecentUrlRepository,
} from '@/storage/repositories';
import type {
  BrowserHistoryEntry,
  CreateHistoryInput,
  ListHistoryOptions,
  PaginatedResult,
  RecentUrlEntry,
  UpdateHistoryInput,
} from '@/storage/types';
import { toStorageError } from '@/storage/types';

function mapRemoteItem(item: BrowserHistoryItem): BrowserHistoryEntry {
  return {
    id: item.id,
    url: item.url,
    title: item.title,
    hostname: item.hostname,
    visitedAt:
      typeof item.visitedAt === 'string'
        ? item.visitedAt
        : new Date(item.visitedAt).toISOString(),
    createdAt:
      typeof item.createdAt === 'string'
        ? item.createdAt
        : new Date(item.createdAt).toISOString(),
  };
}

function toRemoteSort(
  sortBy: ListHistoryOptions['sortBy'],
  sortDirection: ListHistoryOptions['sortDirection'],
): HistoryListSort {
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

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  const name = 'name' in error ? String(error.name) : '';
  return (
    code === 'ERR_CANCELED' ||
    name === 'CanceledError' ||
    name === 'AbortError'
  );
}

export class HistoryService {
  private syncInFlight: AbortController | null = null;
  private recordInFlight = new Map<string, Promise<BrowserHistoryEntry>>();

  constructor(
    private readonly historyRepo: HistoryRepository = historyRepository,
    private readonly recentUrlRepo: RecentUrlRepository = recentUrlRepository,
  ) {}

  /**
   * Cache-first visit write:
   * 1. Persist locally with dedup
   * 2. Sync to backend when authenticated (best-effort)
   * 3. Align local id with server id when the remote write succeeds
   */
  async recordVisit(input: CreateHistoryInput): Promise<BrowserHistoryEntry> {
    const urlKey = input.url.trim().toLowerCase();
    const existing = this.recordInFlight.get(urlKey);

    if (existing) {
      return existing;
    }

    const task = this.performRecordVisit(input).finally(() => {
      this.recordInFlight.delete(urlKey);
    });

    this.recordInFlight.set(urlKey, task);
    return task;
  }

  private async performRecordVisit(
    input: CreateHistoryInput,
  ): Promise<BrowserHistoryEntry> {
    try {
      const entry = await this.historyRepo.create(input);

      await this.recentUrlRepo.upsert({
        url: entry.url,
        title: entry.title,
        hostname: entry.hostname,
        accessedAt: entry.visitedAt,
      });

      if (isAuthenticated()) {
        void this.syncVisitToRemote(entry);
      }

      return entry;
    } catch (error) {
      throw toStorageError(error, 'Failed to record browser visit');
    }
  }

  private async syncVisitToRemote(entry: BrowserHistoryEntry): Promise<void> {
    try {
      const remote = await historyApi.createHistory({
        url: entry.url,
        title: entry.title,
        visitedAt: entry.visitedAt,
      });

      if (remote.id !== entry.id) {
        await this.historyRepo.replaceId(entry.id, remote.id);
      } else {
        await this.historyRepo.upsertRemote(mapRemoteItem(remote));
      }
    } catch (error) {
      if (!shouldIgnoreSyncError(error)) {
        // Local cache remains authoritative when remote sync fails.
      }
    }
  }

  async recordVisits(inputs: CreateHistoryInput[]): Promise<BrowserHistoryEntry[]> {
    const created: BrowserHistoryEntry[] = [];

    for (const input of inputs) {
      created.push(await this.recordVisit(input));
    }

    return created;
  }

  async getById(id: string): Promise<BrowserHistoryEntry | null> {
    return this.historyRepo.findById(id);
  }

  async list(options?: ListHistoryOptions): Promise<PaginatedResult<BrowserHistoryEntry>> {
    return this.historyRepo.list(options);
  }

  async search(
    query: string,
    options?: Omit<ListHistoryOptions, 'query'>,
  ): Promise<PaginatedResult<BrowserHistoryEntry>> {
    return this.historyRepo.search(query, options);
  }

  /**
   * Pull a page from the backend and upsert into the local cache.
   * Returns the remote page mapped to local entry shape, or null when offline/unauthenticated.
   */
  async syncFromRemote(
    options: ListHistoryOptions = {},
    config?: { signal?: AbortSignal },
  ): Promise<PaginatedResult<BrowserHistoryEntry> | null> {
    if (!isAuthenticated()) {
      return null;
    }

    try {
      const remote = await historyApi.listHistory(
        {
          page: options.page,
          limit: options.pageSize,
          search: options.query,
          sort: toRemoteSort(options.sortBy, options.sortDirection),
        },
        { signal: config?.signal },
      );

      const items = remote.items.map(mapRemoteItem);
      await this.historyRepo.upsertManyRemote(items);

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

      throw toStorageError(error, 'Failed to synchronize browser history');
    }
  }

  /**
   * Cache-first page load with optional background remote refresh for page 1.
   */
  async listWithSync(
    options: ListHistoryOptions = {},
    config?: { syncRemote?: boolean; signal?: AbortSignal },
  ): Promise<{
    local: PaginatedResult<BrowserHistoryEntry>;
    remote: PaginatedResult<BrowserHistoryEntry> | null;
  }> {
    const local = await this.historyRepo.list(options);
    const shouldSync = config?.syncRemote !== false && (options.page ?? 1) === 1;

    if (!shouldSync) {
      return { local, remote: null };
    }

    if (this.syncInFlight) {
      this.syncInFlight.abort();
    }

    const controller = new AbortController();
    this.syncInFlight = controller;

    if (config?.signal) {
      const onAbort = () => controller.abort();
      config.signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const remote = await this.syncFromRemote(options, { signal: controller.signal });

      if (!remote) {
        return { local, remote: null };
      }

      const refreshed = await this.historyRepo.list(options);
      return { local: refreshed, remote };
    } catch (error) {
      if (isAbortError(error) || shouldIgnoreSyncError(error)) {
        return { local, remote: null };
      }

      // Cache remains usable when background sync fails unexpectedly.
      return { local, remote: null };
    } finally {
      if (this.syncInFlight === controller) {
        this.syncInFlight = null;
      }
    }
  }

  async update(id: string, input: UpdateHistoryInput): Promise<BrowserHistoryEntry> {
    return this.historyRepo.update(id, input);
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.historyRepo.delete(id);

    if (deleted && isAuthenticated()) {
      try {
        await historyApi.deleteHistory(id);
      } catch (error) {
        if (!shouldIgnoreSyncError(error)) {
          // Local delete already applied.
        }
      }
    }

    return deleted;
  }

  async removeMany(ids: string[]): Promise<number> {
    const deleted = await this.historyRepo.deleteMany(ids);

    if (deleted > 0 && isAuthenticated()) {
      await Promise.allSettled(ids.map((id) => historyApi.deleteHistory(id)));
    }

    return deleted;
  }

  async clear(): Promise<number> {
    const deleted = await this.historyRepo.clear();
    await this.recentUrlRepo.clear();

    if (isAuthenticated()) {
      try {
        await historyApi.clearHistory();
      } catch (error) {
        if (!shouldIgnoreSyncError(error)) {
          // Local clear already applied.
        }
      }
    }

    return deleted;
  }

  async getRecentUrls(limit = 20): Promise<RecentUrlEntry[]> {
    return this.recentUrlRepo.list(limit);
  }

  async getRecentFromHistory(limit = 20): Promise<BrowserHistoryEntry[]> {
    return this.historyRepo.getRecentUrls(limit);
  }

  async getFrequentlyVisited(
    limit = 20,
  ): Promise<(BrowserHistoryEntry & { visitCount: number })[]> {
    return this.historyRepo.getFrequentlyVisited(limit);
  }
}

export const historyService = new HistoryService();

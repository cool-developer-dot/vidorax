import type { StoreApi } from 'zustand';

import {
  createDownload,
  deleteDownload,
  getDownload,
  isApiError,
  listDownloads,
  type DownloadItem,
  type DownloadStatus,
  type DownloadWorkerState,
} from '@/api';
import { downloadEngine, DownloadEngineError } from '@/downloads/engine';
import { syncStatusImmediate } from '@/downloads/engine/synchronizer';
import { reconcileDownloadState } from '@/downloads/reconciliation';
import { parseDownloadWorkerState } from '@/downloads/worker-state';

import { initialDownloadsState } from './state';
import type {
  DownloadUiFilter,
  DownloadsActions,
  DownloadsStore,
} from './types';

const DOWNLOAD_STATUSES: readonly DownloadStatus[] = [
  'QUEUED',
  'DOWNLOADING',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

/** Prevent double-submit create for the same source while in flight. */
const createInFlightKeys = new Set<string>();

function createDedupeKey(input: {
  sourceUrl: string;
  fileName: string;
  fileSize: string | number;
}): string {
  return `${input.sourceUrl.trim()}|${input.fileName.trim()}|${String(input.fileSize)}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Defensive parse — one bad record must not crash the screen. */
export function normalizeDownloadItem(raw: unknown): DownloadItem | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = typeof raw.id === 'string' ? raw.id : null;
  const status =
    typeof raw.status === 'string' &&
    (DOWNLOAD_STATUSES as readonly string[]).includes(raw.status)
      ? (raw.status as DownloadStatus)
      : null;

  if (!id || !status) {
    return null;
  }

  const progressRaw = raw.progress;
  const progress =
    typeof progressRaw === 'number' && Number.isFinite(progressRaw)
      ? Math.max(0, Math.min(100, Math.trunc(progressRaw)))
      : 0;

  const retryRaw = raw.retryCount;
  const retryCount =
    typeof retryRaw === 'number' && Number.isFinite(retryRaw)
      ? Math.max(0, Math.trunc(retryRaw))
      : 0;

  const bitrateRaw = raw.bitrate;
  const bitrate =
    typeof bitrateRaw === 'number' &&
    Number.isFinite(bitrateRaw) &&
    bitrateRaw > 0
      ? Math.trunc(bitrateRaw)
      : null;

  const workerState: DownloadWorkerState | null = parseDownloadWorkerState(
    raw.workerState,
  );

  return {
    id,
    userId: typeof raw.userId === 'string' ? raw.userId : '',
    title: typeof raw.title === 'string' ? raw.title : '',
    sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : '',
    platform: typeof raw.platform === 'string' ? raw.platform : '',
    thumbnailUrl: typeof raw.thumbnailUrl === 'string' ? raw.thumbnailUrl : '',
    fileName: typeof raw.fileName === 'string' ? raw.fileName : '',
    folderId:
      typeof raw.folderId === 'string' && raw.folderId.trim()
        ? raw.folderId
        : null,
    fileSize:
      typeof raw.fileSize === 'string'
        ? raw.fileSize
        : typeof raw.fileSize === 'number'
          ? String(Math.trunc(raw.fileSize))
          : '0',
    status,
    progress,
    quality:
      typeof raw.quality === 'string' && raw.quality.trim()
        ? raw.quality.trim()
        : null,
    resolution:
      typeof raw.resolution === 'string' && raw.resolution.trim()
        ? raw.resolution.trim()
        : null,
    bitrate,
    retryCount,
    workerState,
    errorCode:
      typeof raw.errorCode === 'string'
        ? raw.errorCode
        : raw.errorCode === null
          ? null
          : null,
    errorMessage:
      typeof raw.errorMessage === 'string'
        ? raw.errorMessage
        : raw.errorMessage === null
          ? null
          : null,
    downloadedAt:
      typeof raw.downloadedAt === 'string'
        ? raw.downloadedAt
        : raw.downloadedAt == null
          ? null
          : null,
    createdAt:
      typeof raw.createdAt === 'string'
        ? raw.createdAt
        : new Date(0).toISOString(),
    updatedAt:
      typeof raw.updatedAt === 'string'
        ? raw.updatedAt
        : new Date(0).toISOString(),
  };
}

export function uiFilterToApiStatus(
  filter: DownloadUiFilter,
): DownloadStatus | undefined {
  switch (filter) {
    case 'running':
      return 'DOWNLOADING';
    case 'queued':
      return 'QUEUED';
    case 'paused':
      return 'PAUSED';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    case 'all':
    default:
      return undefined;
  }
}

function buildIndex(
  items: DownloadItem[],
): { itemsById: Record<string, DownloadItem>; orderedIds: string[] } {
  const itemsById: Record<string, DownloadItem> = {};
  const orderedIds: string[] = [];

  for (const item of items) {
    if (itemsById[item.id]) {
      continue;
    }
    itemsById[item.id] = item;
    orderedIds.push(item.id);
  }

  return { itemsById, orderedIds };
}

function mergeAppend(
  existingIds: string[],
  existingById: Record<string, DownloadItem>,
  nextItems: DownloadItem[],
): { itemsById: Record<string, DownloadItem>; orderedIds: string[] } {
  const itemsById = { ...existingById };
  const orderedIds = [...existingIds];
  const seen = new Set(existingIds);

  for (const item of nextItems) {
    itemsById[item.id] = item;
    if (!seen.has(item.id)) {
      orderedIds.push(item.id);
      seen.add(item.id);
    }
  }

  return { itemsById, orderedIds };
}

function mergeRemoteIntoLocal(
  remote: DownloadItem,
  state: Pick<DownloadsStore, 'itemsById' | 'transferById'>,
): { item: DownloadItem; needsBackendReconcile: boolean } {
  const evidence = downloadEngine.getJobEvidence(remote.id);
  const decision = reconcileDownloadState(remote, {
    local: state.itemsById[remote.id],
    transfer: state.transferById[remote.id],
    engine: evidence,
  });
  return {
    item: decision.item,
    needsBackendReconcile: decision.needsBackendReconcile,
  };
}

function scheduleCorrectiveSync(item: DownloadItem): void {
  void syncStatusImmediate(item.id, item.status, {
    progress: item.progress,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage,
  }).catch(() => {
    // Synchronizer owns bounded retry / coalesce.
  });
}

export function createDownloadsActions(
  set: StoreApi<DownloadsStore>['setState'],
  get: StoreApi<DownloadsStore>['getState'],
): DownloadsActions {
  let loadRequestId = 0;
  let loadMoreInFlight = false;
  const pendingDeleteRetryTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  const setMutating = (id: string, mutating: boolean) => {
    set((state) => {
      const mutatingIds = { ...state.mutatingIds };
      if (mutating) {
        mutatingIds[id] = true;
      } else {
        delete mutatingIds[id];
      }
      return { mutatingIds };
    });
  };

  const clearPendingDelete = (id: string) => {
    const timer = pendingDeleteRetryTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      pendingDeleteRetryTimers.delete(id);
    }
    set((state) => {
      if (!state.pendingDeleteIds[id]) {
        return state;
      }
      const pendingDeleteIds = { ...state.pendingDeleteIds };
      delete pendingDeleteIds[id];
      return { pendingDeleteIds };
    });
  };

  const schedulePendingDeleteRetry = (id: string) => {
    if (pendingDeleteRetryTimers.has(id)) {
      return;
    }
    const timer = setTimeout(() => {
      pendingDeleteRetryTimers.delete(id);
      if (!get().pendingDeleteIds[id]) {
        return;
      }
      void (async () => {
        try {
          await deleteDownload(id);
          clearPendingDelete(id);
        } catch (error) {
          if (
            isApiError(error) &&
            (error.status === 404 || error.code === 'NOT_FOUND')
          ) {
            clearPendingDelete(id);
            return;
          }
          // One more delayed attempt, then stop — no storm.
          if (!pendingDeleteRetryTimers.has(id)) {
            const again = setTimeout(() => {
              pendingDeleteRetryTimers.delete(id);
              void deleteDownload(id)
                .then(() => clearPendingDelete(id))
                .catch((err) => {
                  if (
                    isApiError(err) &&
                    (err.status === 404 || err.code === 'NOT_FOUND')
                  ) {
                    clearPendingDelete(id);
                  }
                });
            }, 4_000);
            pendingDeleteRetryTimers.set(id, again);
          }
        }
      })();
    }, 2_000);
    pendingDeleteRetryTimers.set(id, timer);
  };

  const removeFromStore = (id: string) => {
    set((state) => {
      const itemsById = { ...state.itemsById };
      delete itemsById[id];
      const mutatingIds = { ...state.mutatingIds };
      delete mutatingIds[id];
      const transferById = { ...state.transferById };
      delete transferById[id];

      return {
        itemsById,
        orderedIds: state.orderedIds.filter((itemId) => itemId !== id),
        total: Math.max(0, state.total - 1),
        mutatingIds,
        transferById,
      };
    });
  };

  return {
    setQuery: (query) => {
      set({ query });
    },
    setStatusFilter: (statusFilter) => {
      const current = get().statusFilter;
      if (current === statusFilter) {
        return;
      }

      set({
        statusFilter,
        page: 1,
        orderedIds: [],
        itemsById: {},
        ready: false,
        hasMore: false,
        total: 0,
        error: null,
      });
    },
    setSort: (sort) => {
      const current = get().sort;
      if (current === sort) {
        return;
      }

      set({
        sort,
        page: 1,
        orderedIds: [],
        itemsById: {},
        ready: false,
        hasMore: false,
        total: 0,
        error: null,
      });
    },
    applyPage: (items, meta, append = false) => {
      const normalized = items
        .map(normalizeDownloadItem)
        .filter((item): item is DownloadItem => item !== null);

      const corrective: DownloadItem[] = [];

      set((state) => {
        const pendingDeletes = state.pendingDeleteIds;
        const filtered = normalized.filter((item) => !pendingDeletes[item.id]);

        const index = append
          ? mergeAppend(state.orderedIds, state.itemsById, filtered)
          : buildIndex(filtered);

        const itemsById = { ...index.itemsById };
        const orderedIds = [...index.orderedIds];

        for (const id of Object.keys(itemsById)) {
          const remote = itemsById[id];
          if (!remote) {
            continue;
          }
          const merged = mergeRemoteIntoLocal(remote, state);
          itemsById[id] = merged.item;
          if (merged.needsBackendReconcile) {
            corrective.push(merged.item);
          }
        }

        // Preserve in-flight local-only rows not on this remote page.
        if (!append) {
          for (const id of state.orderedIds) {
            if (itemsById[id] || pendingDeletes[id]) {
              continue;
            }
            const local = state.itemsById[id];
            if (!local) {
              continue;
            }
            const evidence = downloadEngine.getJobEvidence(id);
            if (
              evidence.hasActiveWorker ||
              evidence.isQueued ||
              local.status === 'DOWNLOADING' ||
              local.status === 'PAUSED' ||
              local.status === 'QUEUED'
            ) {
              itemsById[id] = local;
              orderedIds.unshift(id);
            }
          }
        }

        return {
          itemsById,
          orderedIds: orderedIds.filter((id) => !pendingDeletes[id]),
          total: meta.total,
          page: meta.page,
          pageSize: meta.pageSize,
          hasMore: meta.hasMore,
          ready: true,
          initialized: true,
          loading: false,
          loadingMore: false,
          refreshing: false,
          error: null,
        };
      });

      for (const item of corrective) {
        scheduleCorrectiveSync(item);
      }
    },
    upsertItem: (item) => {
      const normalized = normalizeDownloadItem(item);
      if (!normalized) {
        return;
      }

      let corrective: DownloadItem | null = null;

      set((state) => {
        if (state.pendingDeleteIds[normalized.id]) {
          return state;
        }

        let merged = normalized;
        if (state.itemsById[normalized.id]) {
          const decision = mergeRemoteIntoLocal(normalized, state);
          merged = decision.item;
          if (decision.needsBackendReconcile) {
            corrective = decision.item;
          }
        }

        const itemsById = {
          ...state.itemsById,
          [merged.id]: merged,
        };
        const orderedIds = state.orderedIds.includes(merged.id)
          ? state.orderedIds
          : [merged.id, ...state.orderedIds];

        return {
          itemsById,
          orderedIds,
          total: state.orderedIds.includes(merged.id)
            ? state.total
            : state.total + 1,
          ready: true,
          initialized: true,
          error: null,
        };
      });

      if (corrective) {
        scheduleCorrectiveSync(corrective);
      }
    },
    patchItem: (id, updates) => {
      set((state) => {
        const existing = state.itemsById[id];
        if (!existing) {
          return state;
        }

        const terminal =
          existing.status === 'COMPLETED' ||
          existing.status === 'CANCELLED';

        if (
          terminal &&
          updates.status !== undefined &&
          updates.status !== existing.status
        ) {
          return state;
        }
        if (
          existing.status === 'FAILED' &&
          updates.status !== undefined &&
          updates.status !== 'FAILED' &&
          updates.status !== 'QUEUED'
        ) {
          return state;
        }

        const merged = { ...existing, ...updates };
        if (
          updates.progress !== undefined &&
          (existing.status === 'DOWNLOADING' || existing.status === 'QUEUED')
        ) {
          merged.progress = Math.max(existing.progress, updates.progress);
        }

        const next = normalizeDownloadItem(merged);
        if (!next) {
          return state;
        }

        return {
          itemsById: {
            ...state.itemsById,
            [id]: next,
          },
        };
      });
    },
    setTransferSnapshot: (snapshot) => {
      set((state) => {
        const previous = state.transferById[snapshot.downloadId];
        const next =
          previous &&
          previous.localState === 'transferring' &&
          snapshot.localState === 'transferring'
            ? {
                ...snapshot,
                progress: Math.max(previous.progress, snapshot.progress),
                bytesWritten: Math.max(
                  previous.bytesWritten,
                  snapshot.bytesWritten,
                ),
              }
            : snapshot;

        return {
          transferById: {
            ...state.transferById,
            [snapshot.downloadId]: next,
          },
        };
      });
    },
    clearTransferSnapshot: (id) => {
      set((state) => {
        if (!state.transferById[id]) {
          return state;
        }
        const transferById = { ...state.transferById };
        delete transferById[id];
        return { transferById };
      });
    },
    load: async (page = 1) => {
      const state = get();
      const requestId = ++loadRequestId;
      const isFirstPage = page === 1;
      const hasKnownState = state.initialized || state.orderedIds.length > 0;

      set({
        loading: isFirstPage && !hasKnownState,
        refreshing: isFirstPage && hasKnownState,
        loadingMore: !isFirstPage,
        error: null,
      });

      try {
        const response = await listDownloads({
          page,
          limit: state.pageSize,
          search: state.query.trim() || undefined,
          status: uiFilterToApiStatus(state.statusFilter),
          sort: state.sort,
        });

        if (requestId !== loadRequestId) {
          return;
        }

        get().applyPage(
          response.items ?? [],
          {
            total: response.pagination?.total ?? 0,
            page: response.pagination?.page ?? page,
            pageSize: response.pagination?.limit ?? state.pageSize,
            hasMore: Boolean(response.pagination?.hasMore),
          },
          !isFirstPage,
        );
      } catch (error) {
        if (requestId !== loadRequestId) {
          return;
        }

        set({
          loading: false,
          loadingMore: false,
          refreshing: false,
          error: getErrorMessage(error, 'Failed to load downloads'),
          initialized: true,
        });
      }
    },
    refresh: async () => {
      await get().load(1);
    },
    loadMore: async () => {
      const state = get();

      if (!state.hasMore || state.loading || state.loadingMore || state.refreshing) {
        return;
      }

      if (loadMoreInFlight) {
        return;
      }

      loadMoreInFlight = true;

      try {
        await get().load(state.page + 1);
      } finally {
        loadMoreInFlight = false;
      }
    },
    search: async (query) => {
      set({ query, page: 1 });
      await get().load(1);
    },
    create: async (input) => {
      const dedupeKey = createDedupeKey(input);
      if (createInFlightKeys.has(dedupeKey)) {
        return null;
      }
      createInFlightKeys.add(dedupeKey);
      set({ error: null });

      try {
        const created = normalizeDownloadItem(
          await createDownload({
            title: input.title.trim() || input.sourceUrl,
            sourceUrl: input.sourceUrl.trim(),
            platform: input.platform.trim() || 'OTHER',
            thumbnailUrl: input.thumbnailUrl.trim(),
            fileName: input.fileName.trim() || 'download.bin',
            fileSize: input.fileSize,
            quality: input.quality ?? null,
            resolution: input.resolution ?? null,
            bitrate:
              typeof input.bitrate === 'number' && input.bitrate > 0
                ? input.bitrate
                : null,
          }),
        );

        if (!created) {
          set({ error: 'Download data was incomplete' });
          return null;
        }

        get().upsertItem(created);

        try {
          await downloadEngine.enqueue({
            id: created.id,
            sourceUrl: created.sourceUrl,
            fileName: created.fileName,
            fileSize: created.fileSize,
            title: created.title,
          });
        } catch (error) {
          set({
            error: getErrorMessage(
              error,
              'Download was created but transfer could not start',
            ),
          });
        }

        return get().itemsById[created.id] ?? created;
      } catch (error) {
        set({
          error: getErrorMessage(error, 'Failed to create download'),
        });
        return null;
      } finally {
        createInFlightKeys.delete(dedupeKey);
      }
    },
    fetchOne: async (id) => {
      const cached = get().itemsById[id];
      if (cached) {
        void (async () => {
          try {
            const remote = normalizeDownloadItem(await getDownload(id));
            if (remote) {
              get().upsertItem(remote);
            }
          } catch {
            // Keep cached item on background refresh failure.
          }
        })();
        return cached;
      }

      set({ error: null });

      try {
        const remote = normalizeDownloadItem(await getDownload(id));
        if (!remote) {
          set({ error: 'Download data was incomplete' });
          return null;
        }
        get().upsertItem(remote);
        return get().itemsById[remote.id] ?? remote;
      } catch (error) {
        if (
          isApiError(error) &&
          (error.code === 'NOT_FOUND' || error.status === 404)
        ) {
          set({ error: null });
          return null;
        }

        set({ error: getErrorMessage(error, 'Failed to load download') });
        throw error;
      }
    },
    pause: async (id) => {
      setMutating(id, true);
      set({ error: null });
      try {
        await downloadEngine.pause(id);
        const current = get().itemsById[id];
        if (current && current.status !== 'PAUSED') {
          get().patchItem(id, { status: 'PAUSED' });
        }
        return get().itemsById[id] ?? null;
      } catch (error) {
        const message =
          error instanceof DownloadEngineError
            ? error.message
            : getErrorMessage(error, 'Failed to pause download');
        set({ error: message });
        return null;
      } finally {
        setMutating(id, false);
      }
    },
    resume: async (id) => {
      setMutating(id, true);
      set({ error: null });
      try {
        await downloadEngine.resume(id);
        return get().itemsById[id] ?? null;
      } catch (error) {
        const message =
          error instanceof DownloadEngineError
            ? error.message
            : getErrorMessage(error, 'Unable to resume this download.');
        set({ error: message });
        return null;
      } finally {
        setMutating(id, false);
      }
    },
    cancel: async (id) => {
      setMutating(id, true);
      set({ error: null });
      try {
        await downloadEngine.cancel(id);
        const current = get().itemsById[id];
        if (current && current.status !== 'CANCELLED') {
          get().patchItem(id, { status: 'CANCELLED' });
        }
        return get().itemsById[id] ?? null;
      } catch (error) {
        set({ error: getErrorMessage(error, 'Failed to cancel download') });
        return null;
      } finally {
        setMutating(id, false);
      }
    },
    retry: async (id) => {
      setMutating(id, true);
      set({ error: null });
      try {
        await downloadEngine.retry(id);
        const current = get().itemsById[id];
        // Retry acceptance must clear stale FAILED fields even if the job
        // already promoted out of pending into an active worker slot.
        if (
          current &&
          (current.status === 'FAILED' ||
            current.status === 'QUEUED' ||
            current.status === 'DOWNLOADING')
        ) {
          const snap = downloadEngine.getQueueSnapshot();
          const activeOrPending =
            snap.pending.some((item) => item.downloadId === id) ||
            snap.active.some((item) => item.downloadId === id);
          if (activeOrPending || current.status !== 'FAILED') {
            get().patchItem(id, {
              ...(current.status === 'FAILED' ? { status: 'QUEUED' } : {}),
              errorMessage: null,
              errorCode: null,
            });
          }
        }
        return get().itemsById[id] ?? null;
      } catch (error) {
        const message =
          error instanceof DownloadEngineError
            ? error.message
            : getErrorMessage(error, 'Unable to retry this download.');
        set({ error: message });
        return null;
      } finally {
        setMutating(id, false);
      }
    },
    remove: async (id) => {
      setMutating(id, true);
      set({ error: null });

      try {
        try {
          await downloadEngine.remove(id);
        } catch {
          // Local cleanup is best-effort.
        }

        try {
          await deleteDownload(id);
        } catch (error) {
          if (
            isApiError(error) &&
            (error.status === 404 || error.code === 'NOT_FOUND')
          ) {
            // Idempotent success.
          } else {
            set((state) => ({
              pendingDeleteIds: { ...state.pendingDeleteIds, [id]: true },
            }));
            removeFromStore(id);
            schedulePendingDeleteRetry(id);
            return true;
          }
        }

        clearPendingDelete(id);
        removeFromStore(id);
        return true;
      } catch (error) {
        set({ error: getErrorMessage(error, 'Failed to remove download') });
        setMutating(id, false);
        return false;
      }
    },
    reset: () => {
      loadRequestId += 1;
      loadMoreInFlight = false;
      createInFlightKeys.clear();
      for (const timer of pendingDeleteRetryTimers.values()) {
        clearTimeout(timer);
      }
      pendingDeleteRetryTimers.clear();
      set(initialDownloadsState);
    },
  };
}

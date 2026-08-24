import type { DownloadItem, DownloadsStore } from './types';

export const selectDownloadOrderedIds = (state: DownloadsStore) => state.orderedIds;
export const selectDownloadItemsById = (state: DownloadsStore) => state.itemsById;
export const selectDownloadsTotal = (state: DownloadsStore) => state.total;
export const selectDownloadsLoading = (state: DownloadsStore) => state.loading;
export const selectDownloadsLoadingMore = (state: DownloadsStore) =>
  state.loadingMore;
export const selectDownloadsRefreshing = (state: DownloadsStore) =>
  state.refreshing;
export const selectDownloadsError = (state: DownloadsStore) => state.error;
export const selectDownloadsHasMore = (state: DownloadsStore) => state.hasMore;
export const selectDownloadsQuery = (state: DownloadsStore) => state.query;
export const selectDownloadsStatusFilter = (state: DownloadsStore) =>
  state.statusFilter;
export const selectDownloadsSort = (state: DownloadsStore) => state.sort;
export const selectDownloadsReady = (state: DownloadsStore) => state.ready;
export const selectDownloadsInitialized = (state: DownloadsStore) =>
  state.initialized;
export const selectDownloadsMutatingIds = (state: DownloadsStore) =>
  state.mutatingIds;

export const selectDownloadTransferById = (state: DownloadsStore) =>
  state.transferById;

export const selectDownloadTransfer =
  (id: string) => (state: DownloadsStore) =>
    state.transferById[id];

export const selectDownloadById =
  (id: string) =>
  (state: DownloadsStore): DownloadItem | undefined =>
    state.itemsById[id];

export const selectIsDownloadMutating =
  (id: string) =>
  (state: DownloadsStore): boolean =>
    Boolean(state.mutatingIds[id]);

/** Derived lists for callers that still expect bucket arrays. */
export const selectActiveDownloads = (state: DownloadsStore): DownloadItem[] =>
  state.orderedIds
    .map((id) => state.itemsById[id])
    .filter(
      (item): item is DownloadItem =>
        item != null && item.status === 'DOWNLOADING',
    );

export const selectCompletedDownloads = (state: DownloadsStore): DownloadItem[] =>
  state.orderedIds
    .map((id) => state.itemsById[id])
    .filter(
      (item): item is DownloadItem =>
        item != null && item.status === 'COMPLETED',
    );

export const selectFailedDownloads = (state: DownloadsStore): DownloadItem[] =>
  state.orderedIds
    .map((id) => state.itemsById[id])
    .filter(
      (item): item is DownloadItem =>
        item != null &&
        (item.status === 'FAILED' || item.status === 'CANCELLED'),
    );

export const selectDownloadQueue = (state: DownloadsStore): DownloadItem[] =>
  state.orderedIds
    .map((id) => state.itemsById[id])
    .filter(
      (item): item is DownloadItem => item != null && item.status === 'QUEUED',
    );

export const selectPausedDownloads = (state: DownloadsStore): DownloadItem[] =>
  state.orderedIds
    .map((id) => state.itemsById[id])
    .filter(
      (item): item is DownloadItem => item != null && item.status === 'PAUSED',
    );

export type DownloadActivitySummary = {
  activeCount: number;
  pausedCount: number;
  queuedCount: number;
  averageProgress: number;
};

/**
 * Compact activity rollup from durable item fields only.
 * Does not read transferById (high-frequency byte ticks).
 */
export function deriveDownloadActivitySummary(
  state: Pick<DownloadsStore, 'orderedIds' | 'itemsById'>,
): DownloadActivitySummary {
  let activeCount = 0;
  let pausedCount = 0;
  let queuedCount = 0;
  let progressSum = 0;

  for (const id of state.orderedIds) {
    const item = state.itemsById[id];
    if (!item) {
      continue;
    }
    if (item.status === 'DOWNLOADING') {
      activeCount += 1;
      progressSum += item.progress;
    } else if (item.status === 'PAUSED') {
      pausedCount += 1;
    } else if (item.status === 'QUEUED') {
      queuedCount += 1;
    }
  }

  return {
    activeCount,
    pausedCount,
    queuedCount,
    averageProgress:
      activeCount > 0 ? Math.round(progressSum / activeCount) : 0,
  };
}

export const selectDownloadActivitySummary = (
  state: DownloadsStore,
): DownloadActivitySummary => deriveDownloadActivitySummary(state);

/** Primitive key — Home can subscribe without object identity churn. */
export function selectDownloadActivitySignature(state: DownloadsStore): string {
  const summary = deriveDownloadActivitySummary(state);
  return `${summary.activeCount}:${summary.pausedCount}:${summary.queuedCount}:${summary.averageProgress}`;
}

/**
 * Changes only when completed catalog identity/metadata changes —
 * not when an active transfer patches progress.
 */
export function selectCompletedCatalogSignature(state: DownloadsStore): string {
  const parts: string[] = [];
  for (const id of state.orderedIds) {
    const item = state.itemsById[id];
    if (!item || item.status !== 'COMPLETED') {
      continue;
    }
    parts.push(
      [
        id,
        item.downloadedAt ?? item.updatedAt,
        item.fileSize,
        item.title,
        item.thumbnailUrl,
        item.quality ?? '',
      ].join(':'),
    );
  }
  return parts.join('|');
}

/** VidoraX-managed bytes from completed download metadata (no filesystem). */
export function selectManagedStorageBytesSignature(
  state: DownloadsStore,
): string {
  let total = 0n;
  for (const id of state.orderedIds) {
    const item = state.itemsById[id];
    if (!item || item.status !== 'COMPLETED') {
      continue;
    }
    try {
      const size = BigInt(item.fileSize || '0');
      if (size > 0n) {
        total += size;
      }
    } catch {
      // Ignore malformed decimal strings.
    }
  }
  return total.toString();
}

import { downloadEngine } from '@/downloads/engine';
import { useDownloadsStore } from '@/store/downloads';
import type { DownloadStatus } from '@/api';

let bound = false;

/** Terminal remote statuses — stale transfer events must not resurrect them. */
const TERMINAL_STATUSES = new Set<DownloadStatus>([
  'COMPLETED',
  'CANCELLED',
]);

/**
 * One-time bridge: engine events → Zustand downloads store.
 * Keeps transfer logic out of UI while preserving itemsById architecture.
 */
export function bindDownloadEngineToStore(): void {
  if (bound) {
    return;
  }
  bound = true;

  downloadEngine.subscribe((event) => {
    const store = useDownloadsStore.getState();

    switch (event.type) {
      case 'status': {
        const existing = store.itemsById[event.downloadId];
        if (
          existing &&
          TERMINAL_STATUSES.has(existing.status) &&
          event.status !== existing.status
        ) {
          // Ignore illegal transitions like CANCELLED → DOWNLOADING from late events.
          break;
        }
        // FAILED may only move to QUEUED (retry); ignore other resurrection.
        if (
          existing?.status === 'FAILED' &&
          event.status !== 'FAILED' &&
          event.status !== 'QUEUED'
        ) {
          break;
        }
        // After Resume has moved to QUEUED/DOWNLOADING, ignore a late PAUSED
        // emit from the previous pause settlement.
        if (
          (existing?.status === 'QUEUED' || existing?.status === 'DOWNLOADING') &&
          event.status === 'PAUSED'
        ) {
          break;
        }
        // After Retry, ignore a late FAILED emit from the previous worker.
        if (
          (existing?.status === 'QUEUED' || existing?.status === 'DOWNLOADING') &&
          event.status === 'FAILED'
        ) {
          break;
        }
        store.patchItem(event.downloadId, {
          status: event.status,
          ...(event.status === 'QUEUED'
            ? {
                errorMessage:
                  event.errorMessage !== undefined ? event.errorMessage : null,
                errorCode: null,
              }
            : event.errorMessage !== undefined
              ? { errorMessage: event.errorMessage }
              : {}),
        });
        break;
      }
      case 'completed': {
        const existing = store.itemsById[event.downloadId];
        if (existing?.status === 'CANCELLED') {
          break;
        }
        store.patchItem(event.downloadId, {
          status: 'COMPLETED',
          progress: 100,
          fileSize: event.fileSize,
          errorMessage: null,
          errorCode: null,
          downloadedAt: new Date().toISOString(),
        });
        store.setTransferSnapshot({
          downloadId: event.downloadId,
          bytesWritten: Number(event.fileSize) || 0,
          totalBytes: Number(event.fileSize) || 0,
          progress: 100,
          bytesPerSecond: null,
          etaSeconds: 0,
          localUri: event.localUri,
          localState: 'complete',
          errorCode: null,
          errorMessage: null,
        });
        break;
      }
      case 'failed': {
        const existing = store.itemsById[event.downloadId];
        if (existing?.status === 'CANCELLED' || existing?.status === 'COMPLETED') {
          break;
        }
        store.patchItem(event.downloadId, {
          status: 'FAILED',
          errorMessage: event.message,
          errorCode: event.code,
        });
        break;
      }
      case 'cancelled': {
        store.patchItem(event.downloadId, {
          status: 'CANCELLED',
          errorMessage: null,
        });
        store.clearTransferSnapshot(event.downloadId);
        break;
      }
      default:
        break;
    }
  });

  // Progress path only — throttled at the worker. Avoids double Zustand updates
  // from also listening to emit({ type: 'progress' }).
  downloadEngine.subscribeProgress((snapshot) => {
    const store = useDownloadsStore.getState();
    const existing = store.itemsById[snapshot.downloadId];
    if (existing && TERMINAL_STATUSES.has(existing.status)) {
      return;
    }

    // Ignore late transferring ticks while paused. Resume emits DOWNLOADING
    // before seeding progress so cumulative bytes are not dropped here.
    if (
      existing?.status === 'PAUSED' &&
      snapshot.localState === 'transferring'
    ) {
      return;
    }

    if (
      existing?.status === 'FAILED' &&
      snapshot.localState === 'transferring'
    ) {
      return;
    }

    // Paused snapshots must not regress an active resume that already moved on.
    if (
      snapshot.localState === 'paused' &&
      (existing?.status === 'DOWNLOADING' || existing?.status === 'QUEUED')
    ) {
      return;
    }

    const priorTransfer = store.transferById[snapshot.downloadId];
    const monotonicBytes = Math.max(
      priorTransfer?.bytesWritten ?? 0,
      snapshot.bytesWritten,
    );
    const monotonicProgress = Math.max(
      existing?.progress ?? 0,
      priorTransfer?.progress ?? 0,
      Math.trunc(snapshot.progress),
    );

    store.setTransferSnapshot({
      ...snapshot,
      bytesWritten: monotonicBytes,
      progress: Math.max(0, Math.min(100, monotonicProgress)),
      totalBytes:
        snapshot.totalBytes != null && snapshot.totalBytes > 0
          ? snapshot.totalBytes
          : priorTransfer?.totalBytes ?? snapshot.totalBytes,
    });

    const updates: {
      progress?: number;
      fileSize?: string;
      status?: 'DOWNLOADING';
    } = {};

    if (snapshot.totalBytes != null && snapshot.totalBytes > 0) {
      updates.progress = Math.max(0, Math.min(100, monotonicProgress));
      updates.fileSize = String(Math.trunc(snapshot.totalBytes));
    } else if (snapshot.localState === 'complete') {
      updates.progress = 100;
    } else if (monotonicProgress > 0) {
      updates.progress = Math.max(0, Math.min(100, monotonicProgress));
    }

    if (
      snapshot.localState === 'transferring' &&
      existing?.status === 'QUEUED'
    ) {
      updates.status = 'DOWNLOADING';
    }

    if (Object.keys(updates).length > 0) {
      store.patchItem(snapshot.downloadId, updates);
    }
  });
}

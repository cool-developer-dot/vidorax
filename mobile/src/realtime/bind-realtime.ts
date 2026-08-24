import { useDownloadsStore } from '@/store/downloads';
import { mergeEventIntoItem } from './apply-event';
import { downloadRealtimeClient } from './client';
import { realtimeClientLog } from './diagnostics';
import { reconcileDownloadsFromApi } from './reconcile';
import { realtimePollingController } from './polling';
import type { DownloadRealtimeEvent } from './types';
import { isTerminalStatus } from './validate';

let bound = false;
let eventUnsub: (() => void) | null = null;

function hasActiveLocalTransfer(downloadId: string): boolean {
  const transfer = useDownloadsStore.getState().transferById[downloadId];
  if (!transfer) {
    return false;
  }
  return (
    transfer.localState === 'transferring' || transfer.localState === 'paused'
  );
}

function handleRealtimeEvent(event: DownloadRealtimeEvent): void {
  if (!downloadRealtimeClient.markSeenEventId(event.eventId)) {
    return;
  }

  const store = useDownloadsStore.getState();
  const existing = store.itemsById[event.downloadId];

  if (existing) {
    const existingVersion = Date.parse(existing.updatedAt);
    if (Number.isFinite(existingVersion) && event.version < existingVersion) {
      return;
    }
    if (
      isTerminalStatus(existing.status) &&
      event.status !== existing.status &&
      Number.isFinite(existingVersion) &&
      event.version <= existingVersion
    ) {
      return;
    }
  }

  // This device owns the transfer — local engine is authoritative for progress.
  // Still accept terminal / status transitions from durable backend.
  if (
    event.type === 'download.progress' &&
    hasActiveLocalTransfer(event.downloadId)
  ) {
    return;
  }

  const merged = mergeEventIntoItem(event, existing);
  if (!merged) {
    realtimeClientLog(
      'ws.message_invalid',
      { downloadId: event.downloadId },
      'warn',
    );
    return;
  }

  // Job-level patch avoids replacing the entire queue list.
  if (existing) {
    store.patchItem(event.downloadId, {
      status: merged.status,
      progress: merged.progress,
      retryCount: merged.retryCount,
      workerState: merged.workerState,
      errorCode: merged.errorCode,
      errorMessage: merged.errorMessage,
      fileSize: merged.fileSize,
      downloadedAt: merged.downloadedAt,
      updatedAt: merged.updatedAt,
    });
    return;
  }

  // Unknown id — upsert skeleton; reconnect reconcile fills remaining fields.
  store.upsertItem(merged);
}

/**
 * Wire singleton realtime client → Zustand downloads store.
 * Safe to call on every login / bootstrap; keeps a single socket.
 */
export function bindDownloadRealtime(): void {
  if (!bound) {
    downloadRealtimeClient.setReconcileHandler(reconcileDownloadsFromApi);
    eventUnsub = downloadRealtimeClient.subscribeEvents(handleRealtimeEvent);
    bound = true;
  }
  realtimePollingController.start();
  downloadRealtimeClient.start();
}

/** Stop transport on logout — durable store is cleared separately. */
export function stopDownloadRealtime(): void {
  eventUnsub?.();
  eventUnsub = null;
  realtimePollingController.stop();
  downloadRealtimeClient.stop();
  bound = false;
}

export function unbindDownloadRealtimeForTests(): void {
  stopDownloadRealtime();
  downloadRealtimeClient.resetForTests();
}

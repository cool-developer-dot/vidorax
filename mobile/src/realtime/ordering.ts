import type { DownloadItem } from '../api/types';
import type { DownloadRealtimeEvent } from './types';
import { isTerminalStatus } from './validate';

/**
 * Convert a validated realtime event into a partial DownloadItem patch.
 * Does not invent fields the durable API does not own (speed/ETA stay local).
 */
export function eventToDownloadPatch(
  event: DownloadRealtimeEvent,
  existing?: DownloadItem | null,
): Partial<DownloadItem> {
  const patch: Partial<DownloadItem> = {
    id: event.downloadId,
    status: event.status,
    progress: event.progress,
    updatedAt: event.timestamp,
  };

  if (event.retryCount !== undefined) {
    patch.retryCount = event.retryCount;
  }

  if (event.workerState !== undefined) {
    patch.workerState = event.workerState;
  }

  if (event.totalBytes !== undefined && event.totalBytes > 0) {
    patch.fileSize = String(event.totalBytes);
  }

  if (event.status === 'FAILED' && event.failureReason) {
    const colon = event.failureReason.indexOf(':');
    if (colon > 0) {
      patch.errorCode = event.failureReason.slice(0, colon).trim();
      patch.errorMessage = event.failureReason.slice(colon + 1).trim();
    } else {
      patch.errorMessage = event.failureReason;
    }
  }

  if (event.status === 'COMPLETED' || event.status === 'CANCELLED') {
    patch.errorCode = null;
    patch.errorMessage = null;
  }

  if (event.status === 'COMPLETED') {
    patch.progress = 100;
    if (!existing?.downloadedAt) {
      patch.downloadedAt = event.timestamp;
    }
  }

  return patch;
}

/**
 * Decide whether an inbound event should apply over current local ledger state.
 */
export function shouldApplyRealtimeEvent(
  event: DownloadRealtimeEvent,
  existing: DownloadItem | null | undefined,
  seenEventIds: Set<string>,
): { apply: boolean; reason: string } {
  if (seenEventIds.has(event.eventId)) {
    return { apply: false, reason: 'duplicate_event_id' };
  }

  if (!existing) {
    return { apply: true, reason: 'new_job' };
  }

  const existingVersion = Date.parse(existing.updatedAt);
  if (Number.isFinite(existingVersion) && event.version < existingVersion) {
    return { apply: false, reason: 'stale_version' };
  }

  if (
    isTerminalStatus(existing.status) &&
    !isTerminalStatus(event.status) &&
    event.version <= existingVersion
  ) {
    return { apply: false, reason: 'terminal_guard' };
  }

  if (
    isTerminalStatus(existing.status) &&
    event.status !== existing.status &&
    event.version < existingVersion
  ) {
    return { apply: false, reason: 'stale_terminal_overwrite' };
  }

  return { apply: true, reason: 'ok' };
}

/** Build a minimal DownloadItem from an event for ordering tests / soft upsert. */
export function skeletonItemFromEvent(
  event: DownloadRealtimeEvent,
): DownloadItem {
  const patch = eventToDownloadPatch(event, null);
  return {
    id: event.downloadId,
    userId: '',
    title: '',
    sourceUrl: '',
    platform: '',
    thumbnailUrl: '',
    fileName: '',
    folderId: null,
    fileSize: event.totalBytes ? String(event.totalBytes) : '0',
    status: event.status,
    progress: event.progress,
    quality: null,
    resolution: null,
    bitrate: null,
    retryCount: event.retryCount ?? 0,
    workerState: event.workerState ?? null,
    errorCode: patch.errorCode ?? null,
    errorMessage: patch.errorMessage ?? null,
    downloadedAt: patch.downloadedAt ?? null,
    createdAt: event.timestamp,
    updatedAt: event.timestamp,
  };
}

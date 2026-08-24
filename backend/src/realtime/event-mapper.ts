import type { DownloadStatus, DownloadWorkerState } from '@prisma/client';
import type { DownloadItem } from '../types/download.types.js';
import type {
  DownloadEventType,
  DownloadRealtimeEvent,
  PublishDownloadEventInput,
} from './types.js';

const TERMINAL_STATUSES = new Set<DownloadStatus>([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export function resolveDownloadEventType(
  item: DownloadItem,
  previous?: PublishDownloadEventInput['previous'],
  forceType?: DownloadEventType,
): DownloadEventType {
  if (forceType) {
    return forceType;
  }

  const prevStatus = previous?.status;
  const statusChanged = prevStatus !== undefined && prevStatus !== item.status;

  if (item.status === 'COMPLETED') {
    return 'download.completed';
  }
  if (item.status === 'CANCELLED') {
    return 'download.cancelled';
  }
  if (item.status === 'FAILED') {
    if (item.workerState === 'RETRY_WAIT') {
      return 'download.retrying';
    }
    return 'download.failed';
  }

  if (statusChanged) {
    if (prevStatus === 'FAILED' && item.status === 'QUEUED') {
      return 'download.retrying';
    }
    if (item.status === 'QUEUED') {
      return 'download.queued';
    }
    if (item.status === 'PAUSED') {
      return 'download.paused';
    }
    if (prevStatus === 'PAUSED' && item.status === 'DOWNLOADING') {
      return 'download.resumed';
    }
    if (item.status === 'DOWNLOADING') {
      return 'download.started';
    }
  }

  if (item.status === 'QUEUED' && !previous) {
    return 'download.queued';
  }

  return 'download.progress';
}

function parseTotalBytes(fileSize: string): number | undefined {
  if (!/^\d+$/.test(fileSize)) {
    return undefined;
  }
  try {
    const value = BigInt(fileSize);
    if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
      return undefined;
    }
    return Number(value);
  } catch {
    return undefined;
  }
}

function buildFailureReason(item: DownloadItem): string | undefined {
  if (item.status !== 'FAILED') {
    return undefined;
  }
  const code = item.errorCode?.trim();
  const message = item.errorMessage?.trim();
  if (code && message) {
    return `${code}: ${message}`;
  }
  return code || message || undefined;
}

/**
 * Build a sanitized realtime event from durable DownloadItem.
 * Omits credentials, paths, signed URLs, and meaningless zeros.
 */
export function buildDownloadRealtimeEvent(
  input: PublishDownloadEventInput,
): DownloadRealtimeEvent {
  const { item, previous, forceType } = input;
  const type = resolveDownloadEventType(item, previous, forceType);
  const version = item.updatedAt.getTime();
  const timestamp = item.updatedAt.toISOString();
  const eventId = `${item.id}:${version}:${type}`;

  const totalBytes = parseTotalBytes(item.fileSize);
  const failureReason = buildFailureReason(item);

  const event: DownloadRealtimeEvent = {
    eventId,
    type,
    downloadId: item.id,
    status: item.status,
    progress: item.progress,
    version,
    timestamp,
  };

  if (totalBytes !== undefined) {
    event.totalBytes = totalBytes;
  }

  if (
    totalBytes !== undefined &&
    item.progress > 0 &&
    item.progress <= 100 &&
    !TERMINAL_STATUSES.has(item.status)
  ) {
    event.downloadedBytes = Math.floor((totalBytes * item.progress) / 100);
  }

  if (item.retryCount > 0) {
    event.retryCount = item.retryCount;
  }

  if (failureReason) {
    event.failureReason = failureReason;
  }

  if (item.workerState !== undefined) {
    event.workerState = item.workerState;
  }

  return event;
}

export function isProgressOnlyEvent(type: DownloadEventType): boolean {
  return type === 'download.progress';
}

export function isTerminalEvent(type: DownloadEventType): boolean {
  return (
    type === 'download.completed' ||
    type === 'download.failed' ||
    type === 'download.cancelled'
  );
}

export type { DownloadStatus, DownloadWorkerState };

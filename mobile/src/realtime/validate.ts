import {
  DOWNLOAD_EVENT_TYPES,
  type DownloadEventType,
  type DownloadRealtimeEvent,
  type DownloadStatus,
  type DownloadWorkerState,
} from './types';

const STATUS_SET = new Set<string>([
  'QUEUED',
  'DOWNLOADING',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

const WORKER_SET = new Set<string>([
  'IDLE',
  'WAITING',
  'STARTING',
  'TRANSFERRING',
  'PAUSING',
  'PAUSED',
  'RETRY_WAIT',
  'VERIFYING',
  'COMPLETING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

const TYPE_SET = new Set<string>(DOWNLOAD_EVENT_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function optionalNonNegInt(value: unknown): number | undefined {
  const n = optionalFiniteNumber(value);
  if (n === undefined || n < 0) {
    return undefined;
  }
  return Math.trunc(n);
}

/**
 * Validate and normalize a raw socket payload.
 * Malformed / unknown events return null (never throw).
 */
export function parseDownloadRealtimeEvent(
  raw: unknown,
): DownloadRealtimeEvent | null {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!isRecord(data)) {
    return null;
  }

  const type =
    typeof data.type === 'string' && TYPE_SET.has(data.type)
      ? (data.type as DownloadEventType)
      : null;
  const downloadId =
    typeof data.downloadId === 'string' && data.downloadId.trim()
      ? data.downloadId.trim()
      : null;
  const status =
    typeof data.status === 'string' && STATUS_SET.has(data.status)
      ? (data.status as DownloadStatus)
      : null;
  const eventId =
    typeof data.eventId === 'string' && data.eventId.trim()
      ? data.eventId.trim()
      : null;
  const version = optionalFiniteNumber(data.version);
  const progressRaw = optionalFiniteNumber(data.progress);
  const timestamp =
    typeof data.timestamp === 'string' && data.timestamp.trim()
      ? data.timestamp.trim()
      : null;

  if (
    !type ||
    !downloadId ||
    !status ||
    !eventId ||
    version === undefined ||
    progressRaw === undefined ||
    !timestamp
  ) {
    return null;
  }

  const progress = Math.max(0, Math.min(100, Math.trunc(progressRaw)));

  const workerRaw = data.workerState;
  let workerState: DownloadWorkerState | null | undefined;
  if (workerRaw === null) {
    workerState = null;
  } else if (typeof workerRaw === 'string' && WORKER_SET.has(workerRaw)) {
    workerState = workerRaw as DownloadWorkerState;
  }

  const event: DownloadRealtimeEvent = {
    eventId,
    type,
    downloadId,
    status,
    progress,
    version: Math.trunc(version),
    timestamp,
  };

  const downloadedBytes = optionalNonNegInt(data.downloadedBytes);
  if (downloadedBytes !== undefined) {
    event.downloadedBytes = downloadedBytes;
  }

  const totalBytes = optionalNonNegInt(data.totalBytes);
  if (totalBytes !== undefined && totalBytes > 0) {
    event.totalBytes = totalBytes;
  }

  const speed = optionalFiniteNumber(data.speed);
  if (speed !== undefined && speed > 0) {
    event.speed = speed;
  }

  const eta = optionalFiniteNumber(data.eta);
  if (eta !== undefined && eta >= 0) {
    event.eta = Math.trunc(eta);
  }

  const retryCount = optionalNonNegInt(data.retryCount);
  if (retryCount !== undefined && retryCount > 0) {
    event.retryCount = retryCount;
  }

  if (
    typeof data.failureReason === 'string' &&
    data.failureReason.trim() &&
    status === 'FAILED'
  ) {
    event.failureReason = data.failureReason.trim().slice(0, 500);
  }

  if (workerState !== undefined) {
    event.workerState = workerState;
  }

  return event;
}

const TERMINAL = new Set<DownloadStatus>([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export function isTerminalStatus(status: DownloadStatus): boolean {
  return TERMINAL.has(status);
}

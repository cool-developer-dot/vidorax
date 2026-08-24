/**
 * Mobile mirror of backend realtime download event contract.
 * Transport only — durable API / Zustand itemsById remain authoritative.
 */

export const DOWNLOAD_EVENT_TYPES = [
  'download.queued',
  'download.started',
  'download.progress',
  'download.paused',
  'download.resumed',
  'download.retrying',
  'download.completed',
  'download.failed',
  'download.cancelled',
] as const;

export type DownloadEventType = (typeof DOWNLOAD_EVENT_TYPES)[number];

export type DownloadStatus =
  | 'QUEUED'
  | 'DOWNLOADING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type DownloadWorkerState =
  | 'IDLE'
  | 'WAITING'
  | 'STARTING'
  | 'TRANSFERRING'
  | 'PAUSING'
  | 'PAUSED'
  | 'RETRY_WAIT'
  | 'VERIFYING'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface DownloadRealtimeEvent {
  eventId: string;
  type: DownloadEventType;
  downloadId: string;
  status: DownloadStatus;
  progress: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: number;
  eta?: number;
  retryCount?: number;
  failureReason?: string;
  workerState?: DownloadWorkerState | null;
  version: number;
  timestamp: string;
}

export type RealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'polling'
  | 'offline'
  | 'auth_error';

export const REALTIME_CLIENT = {
  /** Matches backend REALTIME_CONSTANTS.path */
  path: '/ws/downloads',
  pollingIntervalMs: 4_000,
  reconnectBaseMs: 1_000,
  reconnectMaxMs: 30_000,
  /** Treat connection as stable after this duration (reset backoff). */
  stableConnectionMs: 5_000,
  maxRecentEventIds: 256,
} as const;

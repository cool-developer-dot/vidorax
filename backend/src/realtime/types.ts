import type { DownloadStatus, DownloadWorkerState } from '@prisma/client';
import type { DownloadItem } from '../types/download.types.js';

/**
 * Typed realtime download event contract.
 * WebSocket is transport only — durable DownloadItem remains authoritative.
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

export const TERMINAL_DOWNLOAD_EVENT_TYPES = [
  'download.completed',
  'download.failed',
  'download.cancelled',
] as const satisfies readonly DownloadEventType[];

export type TerminalDownloadEventType =
  (typeof TERMINAL_DOWNLOAD_EVENT_TYPES)[number];

/** Normalized outbound payload — never includes credentials or device paths. */
export interface DownloadRealtimeEventBase {
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
  /** Monotonic revision derived from durable updatedAt epoch ms. */
  version: number;
  /** UTC ISO-8601 timestamp. */
  timestamp: string;
}

export type DownloadRealtimeEvent = DownloadRealtimeEventBase & {
  type: DownloadEventType;
};

export interface PublishDownloadEventInput {
  userId: string;
  item: DownloadItem;
  previous?: {
    status: DownloadStatus;
    progress: number;
    workerState: DownloadWorkerState | null;
  } | null;
  /** Force a specific event type (e.g. create → queued). */
  forceType?: DownloadEventType;
}

export const WS_CLOSE = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  POLICY_VIOLATION: 1008,
  MISSING_TOKEN: 4001,
  INVALID_TOKEN: 4002,
  EXPIRED_TOKEN: 4003,
  WRONG_TOKEN_TYPE: 4004,
  SHUTTING_DOWN: 4008,
} as const;

export const REALTIME_CONSTANTS = {
  /** Path mounted on the same HTTP server as Express. */
  path: '/ws/downloads',
  heartbeatIntervalMs: 30_000,
  heartbeatTimeoutMs: 60_000,
  /** Coalesce progress emits per download. */
  progressThrottleMs: 750,
  /** Skip non-critical progress when socket buffer exceeds this. */
  backpressureBytes: 256 * 1024,
  maxBufferedProgressSkips: 50,
} as const;

import type { DownloadStatus, DownloadWorkerState } from '@prisma/client';
import type { ListSort } from '../utils/pagination.js';

export const DOWNLOAD_STATUSES = [
  'QUEUED',
  'DOWNLOADING',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const satisfies readonly DownloadStatus[];

export const DOWNLOAD_WORKER_STATES = [
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
] as const satisfies readonly DownloadWorkerState[];

export type DownloadSort = ListSort;

/**
 * Canonical download job DTO returned by create/get/list/update.
 * Device-local fields (speed, ETA, absolute paths, retry timers) are never included.
 *
 * Failure reason is represented by errorCode + errorMessage (no separate failureReason column).
 */
export interface DownloadItem {
  id: string;
  userId: string;
  title: string;
  sourceUrl: string;
  platform: string;
  thumbnailUrl: string;
  fileName: string;
  /// Logical organization bucket for this completed media record.
  folderId: string | null;
  /** Total bytes when known; BigInt serialized as decimal string. */
  fileSize: string;
  status: DownloadStatus;
  /** Integer percentage 0–100. */
  progress: number;
  /** Selected quality label when known (e.g. 720p). */
  quality: string | null;
  /** Selected resolution WIDTHxHEIGHT when known. */
  resolution: string | null;
  /** Selected bitrate (bits/sec) when known. Ordinary Int — not BigInt. */
  bitrate: number | null;
  /** Durable transfer retry attempts for this job lifecycle. */
  retryCount: number;
  /** Durable operational worker milestone. */
  workerState: DownloadWorkerState | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Completion timestamp (set on first COMPLETED transition). */
  downloadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDownloadInput {
  title: string;
  sourceUrl: string;
  platform: string;
  thumbnailUrl: string;
  fileName: string;
  fileSize: string | number | bigint;
  /** Optional selected quality label from DownloadQualityOption.label. */
  quality?: string | null;
  /** Optional selected resolution WIDTHxHEIGHT. */
  resolution?: string | null;
  /** Optional selected bitrate in bits/sec. */
  bitrate?: number | string | null;
}

export interface UpdateDownloadInput {
  progress?: number;
  status?: DownloadStatus;
  fileName?: string;
  fileSize?: string | number | bigint;
  thumbnailUrl?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  /**
   * Durable worker milestone only.
   * Must be compatible with the resulting DownloadStatus.
   * retryCount / quality / resolution / bitrate are not client-assignable here.
   */
  workerState?: DownloadWorkerState | null;
}

export interface DownloadListFilters {
  search?: string;
  status?: DownloadStatus;
  platform?: string;
  sort?: DownloadSort;
}

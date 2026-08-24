import type { DownloadPauseState } from 'expo-file-system';
import type { DownloadStatus } from '@/api';

export type LocalTransferState =
  | 'not_started'
  | 'transferring'
  | 'paused'
  | 'complete'
  | 'missing'
  | 'corrupt'
  | 'deleted'
  | 'failed';

export type DownloadEngineErrorCode =
  | 'NETWORK_ERROR'
  | 'NETWORK_TIMEOUT'
  | 'RATE_LIMITED'
  | 'HTTP_ERROR'
  | 'FILE_SYSTEM_ERROR'
  | 'FILE_WRITE_FAILED'
  | 'FILE_APPEND_FAILED'
  | 'FILE_FINALIZE_FAILED'
  | 'INSUFFICIENT_STORAGE'
  | 'INVALID_DESTINATION'
  | 'PERMISSION_DENIED'
  | 'PARTIAL_FILE_CORRUPT'
  | 'FINAL_FILE_INVALID'
  | 'CANCELLED'
  | 'INVALID_RESOURCE'
  | 'TRANSFER_INTERRUPTED'
  | 'PAUSE_FAILED'
  | 'RESUME_FAILED'
  | 'RESUME_UNSUPPORTED'
  | 'RESUME_STATE_MISSING'
  | 'RESUME_STATE_CONFLICT'
  | 'QUEUE_ADMISSION_FAILED'
  | 'PARTIAL_FILE_MISSING'
  | 'RANGE_REJECTED'
  | 'INVALID_RANGE_RESPONSE'
  | 'SOURCE_CHANGED'
  | 'RETRY_EXHAUSTED'
  | 'MERGE_FAILED'
  | 'PART_SIZE_MISMATCH'
  | 'FINAL_SIZE_MISMATCH'
  | 'CANCEL_FAILED'
  | 'WORKER_NOT_FOUND'
  | 'AUTH_ERROR'
  | 'HLS_UNSUPPORTED'
  | 'HLS_ENCRYPTED'
  | 'UNSUPPORTED_DRM'
  | 'UNSUPPORTED_HLS_ENCRYPTION'
  | 'LIVE_HLS_UNSUPPORTED'
  | 'UNSUPPORTED_HLS_BYTERANGE'
  | 'INVALID_HLS_PLAYLIST'
  | 'UNKNOWN_ERROR';

/** Compact HLS job state — no per-segment history. */
export type HlsTransferState = {
  totalSegments: number;
  completedSegments: number;
  currentSegment: number | null;
  downloadedBytes: number;
  failedSegment: number | null;
  retryCount: number;
  lastFailureReason: string | null;
};

/** Optional HTTP validators retained for Range / If-Range resume. */
export type RangeValidators = {
  etag?: string | null;
  lastModified?: string | null;
  /** Full object Content-Length / Content-Range total when known. */
  contentLength?: number | null;
};

export type TransferProgressSnapshot = {
  downloadId: string;
  bytesWritten: number;
  totalBytes: number | null;
  progress: number;
  bytesPerSecond: number | null;
  etaSeconds: number | null;
  localUri: string | null;
  localState: LocalTransferState;
  errorCode: DownloadEngineErrorCode | null;
  errorMessage: string | null;
};

export type LocalDownloadRecord = {
  downloadId: string;
  sourceUrl: string;
  fileName: string;
  expectedFileSize: string;
  localUri: string | null;
  localState: LocalTransferState;
  bytesWritten: number;
  totalBytes: number | null;
  pauseState: DownloadPauseState | null;
  /** ETag / Last-Modified captured for If-Range resume (local only). */
  rangeValidators: RangeValidators | null;
  generation: number;
  errorCode: DownloadEngineErrorCode | null;
  errorMessage: string | null;
  remoteStatus: DownloadStatus | null;
  /** Auto-retries already started after failures. */
  retryCount: number;
  maxRetries: number;
  /** Manual Retry allowed for this failure. */
  retryEligible: boolean;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  updatedAt: string;
  /** Bounded HLS transfer checkpoint (local only). */
  hlsTransfer?: HlsTransferState | null;
  /** Compact multi-range progressive checkpoint (local only). */
  multiRange?: MultiRangeTransferState | null;
};

/** Per-part status for multi-range progressive downloads. */
export type MultiRangePartStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type MultiRangePartState = {
  index: number;
  rangeStart: number;
  rangeEnd: number;
  downloadedBytes: number;
  status: MultiRangePartStatus;
  retryCount: number;
  lastFailureReason: string | null;
};

/** Compact multi-range job checkpoint — no response bodies. */
export type MultiRangeTransferState = {
  contentLength: number;
  workerCount: number;
  sourceValidators: RangeValidators | null;
  parts: MultiRangePartState[];
  failedPart: number | null;
};

export type EnqueueInput = {
  id: string;
  sourceUrl: string;
  fileName: string;
  fileSize: string;
  title?: string;
  /** When true, skip auto-start (recovery of paused items). */
  preferPaused?: boolean;
};

export type EngineEvent =
  | { type: 'progress'; snapshot: TransferProgressSnapshot }
  | { type: 'status'; downloadId: string; status: DownloadStatus; errorMessage?: string | null }
  | {
      type: 'completed';
      downloadId: string;
      localUri: string;
      fileSize: string;
      progress: number;
    }
  | { type: 'failed'; downloadId: string; code: DownloadEngineErrorCode; message: string }
  | { type: 'cancelled'; downloadId: string }
  | { type: 'removed'; downloadId: string };

import { DownloadStatus } from '@prisma/client';
import { AppError } from '../../utils/errors/index.js';

/**
 * Canonical download lifecycle transitions.
 * All mutation paths must use assertDownloadTransition — do not scatter checks.
 */
export const DOWNLOAD_STATUS_TRANSITIONS: Record<
  DownloadStatus,
  readonly DownloadStatus[]
> = {
  QUEUED: [
    DownloadStatus.DOWNLOADING,
    DownloadStatus.FAILED,
    DownloadStatus.CANCELLED,
  ],
  DOWNLOADING: [
    DownloadStatus.PAUSED,
    DownloadStatus.COMPLETED,
    DownloadStatus.FAILED,
    DownloadStatus.CANCELLED,
  ],
  PAUSED: [
    DownloadStatus.DOWNLOADING,
    DownloadStatus.FAILED,
    DownloadStatus.CANCELLED,
  ],
  FAILED: [
    // Intentional Retry only — re-enter the queue before DOWNLOADING.
    DownloadStatus.QUEUED,
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export const isTerminalDownloadStatus = (status: DownloadStatus): boolean =>
  status === DownloadStatus.COMPLETED || status === DownloadStatus.CANCELLED;

/**
 * Idempotent same-status updates are allowed (pause twice, etc.).
 * Cross-status moves must appear in DOWNLOAD_STATUS_TRANSITIONS.
 */
export const assertDownloadTransition = (
  currentStatus: DownloadStatus,
  nextStatus: DownloadStatus,
): void => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!DOWNLOAD_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new AppError(
      `Cannot transition download from ${currentStatus} to ${nextStatus}`,
      409,
    );
  }
};

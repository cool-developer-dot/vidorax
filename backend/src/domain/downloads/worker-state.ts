import {
  DownloadStatus,
  DownloadWorkerState,
} from '@prisma/client';
import { AppError } from '../../utils/errors/index.js';

/**
 * Canonical worker states — single domain definition for backend + mobile mapping.
 * Distinct from customer-facing DownloadStatus.
 */
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

export type DurableWorkerStateMilestone =
  | 'WAITING'
  | 'STARTING'
  | 'TRANSFERRING'
  | 'PAUSED'
  | 'RETRY_WAIT'
  | 'VERIFYING'
  | 'FAILED'
  | 'COMPLETED'
  | 'CANCELLED';

/** Worker states worth persisting as durable milestones (not animation telemetry). */
export const DURABLE_WORKER_STATE_MILESTONES: ReadonlySet<DownloadWorkerState> =
  new Set([
    DownloadWorkerState.WAITING,
    DownloadWorkerState.STARTING,
    DownloadWorkerState.TRANSFERRING,
    DownloadWorkerState.PAUSED,
    DownloadWorkerState.RETRY_WAIT,
    DownloadWorkerState.VERIFYING,
    DownloadWorkerState.FAILED,
    DownloadWorkerState.COMPLETED,
    DownloadWorkerState.CANCELLED,
  ]);

/**
 * Compatible worker states for each customer-facing DownloadStatus.
 */
export const WORKER_STATES_FOR_STATUS: Record<
  DownloadStatus,
  readonly DownloadWorkerState[]
> = {
  QUEUED: [
    DownloadWorkerState.IDLE,
    DownloadWorkerState.WAITING,
    DownloadWorkerState.STARTING,
  ],
  DOWNLOADING: [
    DownloadWorkerState.TRANSFERRING,
    DownloadWorkerState.PAUSING,
    DownloadWorkerState.VERIFYING,
    DownloadWorkerState.COMPLETING,
  ],
  PAUSED: [DownloadWorkerState.PAUSED],
  FAILED: [DownloadWorkerState.FAILED, DownloadWorkerState.RETRY_WAIT],
  COMPLETED: [DownloadWorkerState.COMPLETED],
  CANCELLED: [DownloadWorkerState.CANCELLED],
};

export const isValidWorkerStateForDownloadStatus = (
  status: DownloadStatus,
  workerState: DownloadWorkerState,
): boolean => WORKER_STATES_FOR_STATUS[status].includes(workerState);

export const assertWorkerStateForDownloadStatus = (
  status: DownloadStatus,
  workerState: DownloadWorkerState,
): void => {
  if (!isValidWorkerStateForDownloadStatus(status, workerState)) {
    throw new AppError(
      `workerState ${workerState} is incompatible with status ${status}`,
      409,
    );
  }
};

/**
 * Default durable worker state when status changes and client omits workerState.
 */
export const defaultWorkerStateForStatus = (
  status: DownloadStatus,
): DownloadWorkerState => {
  switch (status) {
    case DownloadStatus.QUEUED:
      return DownloadWorkerState.WAITING;
    case DownloadStatus.DOWNLOADING:
      return DownloadWorkerState.TRANSFERRING;
    case DownloadStatus.PAUSED:
      return DownloadWorkerState.PAUSED;
    case DownloadStatus.FAILED:
      return DownloadWorkerState.FAILED;
    case DownloadStatus.COMPLETED:
      return DownloadWorkerState.COMPLETED;
    case DownloadStatus.CANCELLED:
      return DownloadWorkerState.CANCELLED;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

/**
 * Resolve next workerState for an update:
 * - explicit client value (must be compatible)
 * - else if status changing → status default
 * - else keep existing (if still compatible) or status default
 */
export const resolveWorkerStateForUpdate = (options: {
  currentStatus: DownloadStatus;
  nextStatus: DownloadStatus;
  currentWorkerState: DownloadWorkerState | null;
  requestedWorkerState?: DownloadWorkerState | null;
}): DownloadWorkerState => {
  const { nextStatus, currentWorkerState, requestedWorkerState } = options;

  if (requestedWorkerState != null) {
    assertWorkerStateForDownloadStatus(nextStatus, requestedWorkerState);
    return requestedWorkerState;
  }

  if (
    currentWorkerState != null &&
    isValidWorkerStateForDownloadStatus(nextStatus, currentWorkerState)
  ) {
    return currentWorkerState;
  }

  return defaultWorkerStateForStatus(nextStatus);
};

import type { QueueWaitingReason } from '../scheduler/waiting-reason';
import type { DownloadExecutionDisplayState } from './types';

export type DisplayStatusInput = {
  /** Customer-facing DownloadStatus. */
  status: 'QUEUED' | 'DOWNLOADING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | null;
  /** Operational worker state when known (never shown raw to customer). */
  workerState?: string | null;
  waitingReason?: QueueWaitingReason | null;
  /** React Native AppState: active | inactive | background. */
  appState: 'active' | 'inactive' | 'background' | string;
  /** True when FGS / ledger says this id is under protected execution. */
  backgroundServiceActive?: boolean;
  /** True when a JS (or native) transfer worker owns this id. */
  hasActiveExecution?: boolean;
  retryDelay?: boolean;
};

/**
 * Derive customer-facing execution display state.
 * Pure. Not persisted. Does not expose TRANSFERRING / RETRY_WAIT enums.
 */
export function deriveDownloadExecutionDisplayState(
  input: DisplayStatusInput,
): DownloadExecutionDisplayState {
  const status = input.status;

  if (status === 'COMPLETED') {
    return 'COMPLETED';
  }
  if (status === 'CANCELLED') {
    return 'CANCELLED';
  }
  if (status === 'PAUSED') {
    return 'PAUSED';
  }
  if (status === 'FAILED') {
    if (
      input.retryDelay ||
      input.waitingReason === 'RETRY_DELAY' ||
      (input.workerState ?? '').toUpperCase() === 'RETRY_WAIT'
    ) {
      return 'WAITING_FOR_RETRY';
    }
    return 'FAILED';
  }

  if (status === 'DOWNLOADING' || input.hasActiveExecution) {
    const ws = (input.workerState ?? '').toUpperCase();
    if (ws === 'VERIFYING' || ws === 'COMPLETING') {
      return 'FINALIZING';
    }
    const appBackground =
      input.appState === 'background' || input.appState === 'inactive';
    // Strict: only claim background when FGS is known active for this work.
    if (appBackground && input.backgroundServiceActive === true) {
      return 'DOWNLOADING_BACKGROUND';
    }
    return 'DOWNLOADING_FOREGROUND';
  }

  if (status === 'QUEUED' || status == null) {
    if (input.retryDelay || input.waitingReason === 'RETRY_DELAY') {
      return 'WAITING_FOR_RETRY';
    }
    if (input.waitingReason === 'RECOVERY_PENDING') {
      return 'PREPARING';
    }
    if (input.waitingReason === 'OFFLINE') {
      return 'WAITING_FOR_CONNECTION';
    }
    if (input.waitingReason === 'WAITING_FOR_WIFI') {
      return 'WAITING_FOR_WIFI';
    }
    if (input.waitingReason === 'CAPACITY') {
      return 'WAITING_CAPACITY';
    }
    return 'QUEUED';
  }

  return 'QUEUED';
}

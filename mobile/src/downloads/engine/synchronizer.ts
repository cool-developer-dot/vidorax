/**
 * Backend job ledger synchronizer — bridge only.
 * Transfer authority remains the engine; this never fails a healthy worker.
 */
import {
  getDownload,
  isApiError,
  updateDownload,
  type DownloadStatus,
  type DownloadWorkerState,
  type UpdateDownloadRequest,
} from '@/api';

import {
  isSameSyncSnapshot,
  shouldBlockSyncAgainstTerminal,
} from '../reconciliation';
import {
  defaultWorkerStateForStatus,
  DURABLE_WORKER_STATE_MILESTONES,
} from '../worker-state';
import { DOWNLOAD_ENGINE } from './constants';

export type BackendSyncSnapshot = {
  status?: DownloadStatus;
  progress?: number;
  fileSize?: string;
  fileName?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  workerState?: DownloadWorkerState | null;
};

type PendingSync = {
  status?: DownloadStatus;
  progress?: number;
  fileSize?: string;
  fileName?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  workerState?: DownloadWorkerState | null;
  /** Highest progress successfully accepted by the backend (monotonic). */
  lastAckedProgress: number;
  /** Last payload successfully accepted (dedupe). */
  lastSent: BackendSyncSnapshot | null;
  /** Once CANCELLED/COMPLETED is known locally, block resurrection patches. */
  localTerminal: DownloadStatus | null;
  /** Bounded backend-sync retry counter (not transfer retry). */
  syncAttempts: number;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
};

const SYNC_BACKOFF_MS = [1_000, 2_000, 4_000] as const;
const MAX_SYNC_ATTEMPTS = 8;

const pendingById = new Map<string, PendingSync>();

function getOrCreate(id: string): PendingSync {
  const existing = pendingById.get(id);
  if (existing) {
    return existing;
  }
  const created: PendingSync = {
    lastAckedProgress: 0,
    lastSent: null,
    localTerminal: null,
    syncAttempts: 0,
    timer: null,
    inFlight: false,
  };
  pendingById.set(id, created);
  return created;
}

function backoffMs(attempts: number): number {
  const index = Math.min(
    Math.max(0, attempts - 1),
    SYNC_BACKOFF_MS.length - 1,
  );
  return SYNC_BACKOFF_MS[index] ?? 4_000;
}

function markTerminal(entry: PendingSync, status: DownloadStatus): void {
  if (status === 'CANCELLED' || status === 'COMPLETED') {
    entry.localTerminal = status;
  }
  if (status === 'QUEUED' || status === 'DOWNLOADING' || status === 'PAUSED') {
    // Legal lifecycle leaves terminal only via new job — never clear CANCELLED/COMPLETED.
    if (entry.localTerminal === 'CANCELLED' || entry.localTerminal === 'COMPLETED') {
      return;
    }
    entry.localTerminal = null;
  }
}

function buildPayload(entry: PendingSync): UpdateDownloadRequest {
  const payload: UpdateDownloadRequest = {};

  if (entry.status !== undefined) {
    payload.status = entry.status;
  }

  if (
    entry.progress !== undefined &&
    entry.progress >= entry.lastAckedProgress
  ) {
    payload.progress = entry.progress;
  }

  if (entry.fileSize !== undefined) {
    payload.fileSize = entry.fileSize;
  }
  if (entry.fileName !== undefined) {
    payload.fileName = entry.fileName;
  }
  if (entry.errorCode !== undefined) {
    payload.errorCode = entry.errorCode;
  }
  if (entry.errorMessage !== undefined) {
    payload.errorMessage = entry.errorMessage;
  }
  if (
    entry.workerState !== undefined &&
    entry.workerState !== null &&
    DURABLE_WORKER_STATE_MILESTONES.has(entry.workerState)
  ) {
    payload.workerState = entry.workerState;
  }

  return payload;
}

function snapshotFromPayload(payload: UpdateDownloadRequest): BackendSyncSnapshot {
  return {
    status: payload.status,
    progress: payload.progress,
    errorCode: payload.errorCode,
    errorMessage: payload.errorMessage,
    workerState: payload.workerState,
  };
}

function clearPendingFields(entry: PendingSync): void {
  entry.status = undefined;
  entry.progress = undefined;
  entry.fileSize = undefined;
  entry.fileName = undefined;
  entry.errorCode = undefined;
  entry.errorMessage = undefined;
  entry.workerState = undefined;
}

function restorePending(
  entry: PendingSync,
  payload: UpdateDownloadRequest,
  prior: {
    status?: DownloadStatus;
    progress?: number;
    fileSize?: string;
    fileName?: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    workerState?: DownloadWorkerState | null;
  },
  options: { dropStatus?: boolean; dropProgress?: boolean },
): void {
  if (
    !options.dropStatus &&
    payload.status !== undefined &&
    entry.status === undefined
  ) {
    entry.status = prior.status;
  }
  if (
    !options.dropProgress &&
    payload.progress !== undefined &&
    entry.progress === undefined &&
    prior.progress !== undefined &&
    prior.progress >= entry.lastAckedProgress
  ) {
    entry.progress = prior.progress;
  }
  if (payload.fileSize !== undefined && entry.fileSize === undefined) {
    entry.fileSize = prior.fileSize;
  }
  if (payload.fileName !== undefined && entry.fileName === undefined) {
    entry.fileName = prior.fileName;
  }
  if (payload.errorCode !== undefined && entry.errorCode === undefined) {
    entry.errorCode = prior.errorCode;
  }
  if (payload.errorMessage !== undefined && entry.errorMessage === undefined) {
    entry.errorMessage = prior.errorMessage;
  }
  if (payload.workerState !== undefined && entry.workerState === undefined) {
    entry.workerState = prior.workerState;
  }
}

function hasPendingWork(entry: PendingSync): boolean {
  return (
    entry.status !== undefined ||
    entry.progress !== undefined ||
    entry.fileSize !== undefined ||
    entry.fileName !== undefined ||
    entry.errorCode !== undefined ||
    entry.errorMessage !== undefined ||
    entry.workerState !== undefined
  );
}

function schedule(id: string, delayMs: number): void {
  const entry = getOrCreate(id);
  if (entry.timer) {
    clearTimeout(entry.timer);
  }
  entry.timer = setTimeout(() => {
    entry.timer = null;
    void flush(id);
  }, delayMs);
}

async function handleConflict(
  id: string,
  entry: PendingSync,
  payload: UpdateDownloadRequest,
): Promise<'drop' | 'retry-corrected' | 'retry-status-only'> {
  try {
    const remote = await getDownload(id);

    // Remote already matches desired terminal/status — treat as ack.
    if (
      payload.status &&
      remote.status === payload.status &&
      (payload.progress === undefined ||
        remote.progress >= (payload.progress ?? 0))
    ) {
      entry.lastAckedProgress = Math.max(
        entry.lastAckedProgress,
        remote.progress,
      );
      entry.lastSent = {
        status: remote.status,
        progress: remote.progress,
        errorCode: remote.errorCode,
        errorMessage: remote.errorMessage,
      };
      if (remote.status === 'CANCELLED' || remote.status === 'COMPLETED') {
        entry.localTerminal = remote.status;
      }
      return 'drop';
    }

    // Remote is terminal — never retry a non-matching mutation.
    if (remote.status === 'CANCELLED' || remote.status === 'COMPLETED') {
      entry.localTerminal = remote.status;
      entry.lastAckedProgress = Math.max(
        entry.lastAckedProgress,
        remote.progress,
      );
      return 'drop';
    }

    // Progress conflict with a status transition — retry status-only.
    if (payload.status !== undefined && payload.progress !== undefined) {
      entry.status = payload.status;
      if (payload.errorCode !== undefined) {
        entry.errorCode = payload.errorCode;
      }
      if (payload.errorMessage !== undefined) {
        entry.errorMessage = payload.errorMessage;
      }
      return 'retry-status-only';
    }

    // Status-only illegal transition — drop poison status.
    if (payload.status !== undefined && payload.progress === undefined) {
      return 'drop';
    }

    // Progress-only conflict — drop regressing progress; keep newer pending.
    return 'drop';
  } catch {
    // Could not fetch — bounded retry of latest coalesced snapshot only.
    return 'retry-corrected';
  }
}

async function flush(id: string): Promise<void> {
  const entry = pendingById.get(id);
  if (!entry) {
    return;
  }

  if (entry.inFlight) {
    schedule(id, 100);
    return;
  }

  if (entry.syncAttempts >= MAX_SYNC_ATTEMPTS) {
    // Cap retries — keep latest snapshot for a future explicit status sync.
    return;
  }

  const payload = buildPayload(entry);

  if (Object.keys(payload).length === 0) {
    entry.progress = undefined;
    return;
  }

  if (shouldBlockSyncAgainstTerminal(entry.localTerminal, payload)) {
    clearPendingFields(entry);
    return;
  }

  // Dedupe identical snapshots already accepted by backend.
  if (entry.lastSent && isSameSyncSnapshot(entry.lastSent, payload)) {
    clearPendingFields(entry);
    return;
  }

  const prior = {
    status: entry.status,
    progress: entry.progress,
    fileSize: entry.fileSize,
    fileName: entry.fileName,
    errorCode: entry.errorCode,
    errorMessage: entry.errorMessage,
    workerState: entry.workerState,
  };

  clearPendingFields(entry);
  entry.inFlight = true;

  try {
    await updateDownload(id, payload);
    entry.syncAttempts = 0;
    if (payload.progress !== undefined) {
      entry.lastAckedProgress = Math.max(
        entry.lastAckedProgress,
        payload.progress,
      );
    }
    entry.lastSent = snapshotFromPayload(payload);
    if (payload.status === 'CANCELLED' || payload.status === 'COMPLETED') {
      entry.localTerminal = payload.status;
    }
    if (payload.status === 'QUEUED' && entry.localTerminal !== 'CANCELLED') {
      // Retry path — clear non-terminal failure ack tracking only.
    }
  } catch (error) {
    // Sync failures must never fail the media transfer.
    const apiError = isApiError(error) ? error : null;
    const status = apiError?.status ?? null;
    const isConflict = status === 409;
    const isUnauthorized = status === 401 || apiError?.isUnauthorized === true;

    entry.syncAttempts += 1;

    if (isConflict) {
      const decision = await handleConflict(id, entry, payload);
      if (decision === 'retry-status-only') {
        schedule(id, 50);
        return;
      }
      if (decision === 'retry-corrected' && hasPendingWork(entry)) {
        schedule(id, backoffMs(entry.syncAttempts));
        return;
      }
      // drop — do not restore poison payload
      return;
    }

    if (isUnauthorized) {
      // Auth refresh already attempted by axios. Keep latest snapshot pending.
      restorePending(entry, payload, prior, {});
      if (entry.syncAttempts < MAX_SYNC_ATTEMPTS) {
        schedule(id, backoffMs(entry.syncAttempts));
      }
      return;
    }

    // Transient network/server — coalesce latest and backoff.
    restorePending(entry, payload, prior, {});
    if (entry.syncAttempts < MAX_SYNC_ATTEMPTS) {
      schedule(id, backoffMs(entry.syncAttempts));
    }
  } finally {
    entry.inFlight = false;
    if (hasPendingWork(entry) && entry.syncAttempts < MAX_SYNC_ATTEMPTS) {
      schedule(id, Math.max(1500, backoffMs(entry.syncAttempts)));
    }
  }
}

/**
 * Throttled progress sync. Status transitions should use syncStatusImmediate.
 * Per-job timer — concurrent downloads do not suppress each other.
 */
export function syncProgressThrottled(
  id: string,
  progress: number,
  fileSize?: string,
): void {
  const entry = getOrCreate(id);
  if (entry.localTerminal === 'CANCELLED' || entry.localTerminal === 'COMPLETED') {
    return;
  }

  const next = Math.max(0, Math.min(100, Math.trunc(progress)));
  // Coalesce: keep highest pending progress only.
  entry.progress =
    entry.progress === undefined ? next : Math.max(entry.progress, next);
  if (fileSize !== undefined) {
    entry.fileSize = fileSize;
  }
  schedule(id, DOWNLOAD_ENGINE.backendProgressIntervalMs);
}

/**
 * Persist an important status transition immediately.
 * Prefer status-only payloads so a stale progress:0 cannot 409 the transition.
 */
export async function syncStatusImmediate(
  id: string,
  status: DownloadStatus,
  extras?: {
    progress?: number;
    fileSize?: string;
    fileName?: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    workerState?: DownloadWorkerState | null;
  },
): Promise<void> {
  const entry = getOrCreate(id);

  if (
    shouldBlockSyncAgainstTerminal(entry.localTerminal, { status }) &&
    status !== entry.localTerminal
  ) {
    return;
  }

  markTerminal(entry, status);

  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  entry.status = status;
  // Fresh lifecycle sync gets another attempt budget.
  entry.syncAttempts = 0;

  if (
    extras?.progress !== undefined &&
    extras.progress >= entry.lastAckedProgress
  ) {
    entry.progress = extras.progress;
  }

  if (extras?.fileSize !== undefined) {
    entry.fileSize = extras.fileSize;
  }
  if (extras?.fileName !== undefined) {
    entry.fileName = extras.fileName;
  }
  if (extras?.errorCode !== undefined) {
    entry.errorCode = extras.errorCode;
  }
  if (extras?.errorMessage !== undefined) {
    entry.errorMessage = extras.errorMessage;
  }

  // Durable milestone only — default from status when caller omits.
  const resolvedWorker =
    extras?.workerState !== undefined
      ? extras.workerState
      : defaultWorkerStateForStatus(status);
  if (
    resolvedWorker != null &&
    DURABLE_WORKER_STATE_MILESTONES.has(resolvedWorker)
  ) {
    entry.workerState = resolvedWorker;
  }

  await flush(id);
}

export function clearSyncState(id: string): void {
  const entry = pendingById.get(id);
  if (!entry) {
    return;
  }
  if (entry.timer) {
    clearTimeout(entry.timer);
  }
  pendingById.delete(id);
}

/** Test/debug helper — not for UI. */
export function getSyncDebugState(id: string): {
  pending: boolean;
  localTerminal: DownloadStatus | null;
  lastAckedProgress: number;
  syncAttempts: number;
} | null {
  const entry = pendingById.get(id);
  if (!entry) {
    return null;
  }
  return {
    pending: hasPendingWork(entry) || entry.inFlight,
    localTerminal: entry.localTerminal,
    lastAckedProgress: entry.lastAckedProgress,
    syncAttempts: entry.syncAttempts,
  };
}

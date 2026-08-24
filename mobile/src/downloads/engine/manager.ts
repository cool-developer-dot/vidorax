import {
  DOWNLOAD_ENGINE,
} from './constants';
import { DownloadEngineError, toUserFacingErrorMessage } from './errors';
import {
  deleteDownloadFiles,
  deleteRangePartQuiet,
  resolveDestinationFile,
  verifyCompletedFile,
  verifyPartialForRetry,
} from './file-paths';
import { cleanupHlsWorkspace, HlsTransferWorker } from './hls';
import {
  cleanupMultiRangeWorkspace,
  hasResumableMultiRange,
  sumMultiRangeDownloaded,
} from './multi-range';
import {
  assessLocalFile,
} from './local-file-state';
import {
  buildDurablePauseState,
  parseAndroidResumeOffset,
  readPartialFileSize,
} from './pause-state';
import {
  getLocalRecord,
  listLocalRecords,
  removeLocalRecord,
  upsertLocalRecord,
} from './persistence';
import { toTransferSnapshot } from './progress';
import {
  decideRecoveryState,
  type RecoveryDecision,
} from './recovery-decision';
import { isPlaylistOrStreamUrl, isSafeHttpUrl } from './resource-guard';
import {
  applyRetryJitter,
  computeRetryDelayMs,
  isAutoRetryableCode,
  isManualRetryAllowed,
  shouldScheduleAutoRetry,
} from './retry-policy';
import {
  getDownloadSettings,
  getEffectiveMaxConcurrentDownloads,
  isAutoResumeEnabled,
  normalizeMaxConcurrentDownloads,
  subscribeDownloadSettings,
} from '../settings';
import {
  getDownloadNetworkState,
  startDownloadNetworkMonitor,
  subscribeDownloadNetwork,
} from '../network';
import {
  AdmissionScheduler,
  shouldHoldActiveTransfer,
  evaluateNetworkAdmission,
  type JobStatusProbe,
  type QueueSnapshot,
  type SchedulerJobInput,
} from '../scheduler';
import { hardeningLog } from '../hardening-diagnostics';
import {
  getDownloadExecutionCoordinator,
  downloadAppLifecycle,
} from '../execution';
import { clearSyncState, syncStatusImmediate } from './synchronizer';
import type {
  EnqueueInput,
  EngineEvent,
  LocalDownloadRecord,
  LocalTransferState,
  TransferProgressSnapshot,
} from './types';
import { cleanupCancelledDownload, TransferWorker } from './worker';
import { File } from 'expo-file-system';

type Listener = (event: EngineEvent) => void;
type ProgressListener = (snapshot: TransferProgressSnapshot) => void;

/** Progressive or HLS — same cancel/pause/run surface for the manager. */
type AnyTransferWorker = TransferWorker | HlsTransferWorker;

const TERMINAL_LOCAL: ReadonlySet<LocalTransferState> = new Set([
  'complete',
  'deleted',
  'corrupt',
]);

function defaultRetryFields(
  existing?: LocalDownloadRecord | null,
): Pick<
  LocalDownloadRecord,
  | 'retryCount'
  | 'maxRetries'
  | 'retryEligible'
  | 'lastAttemptAt'
  | 'nextRetryAt'
> {
  return {
    retryCount: existing?.retryCount ?? 0,
    maxRetries: existing?.maxRetries ?? DOWNLOAD_ENGINE.maxAutoRetryAttempts,
    retryEligible: existing?.retryEligible ?? true,
    lastAttemptAt: existing?.lastAttemptAt ?? null,
    nextRetryAt: existing?.nextRetryAt ?? null,
  };
}
/**
 * Public facade for the VidoraX download transfer engine.
 * Owns queue scheduling + worker lifecycle. Does not own UI or Zustand.
 *
 * One authoritative AdmissionScheduler decides capacity / network / FIFO admission.
 * Progressive and HLS share the same concurrency budget.
 */
class DownloadEngine {
  private scheduler: AdmissionScheduler | null = null;
  private unsubNetwork: (() => void) | null = null;
  private unsubSettings: (() => void) | null = null;
  private readonly workers = new Map<string, AnyTransferWorker>();
  private readonly locks = new Set<string>();
  /**
   * IDs suppressed after cancel/remove so a worker promoted before cancel
   * cannot start (or complete) after the terminal transition.
   */
  private readonly suppressedIds = new Set<string>();
  private readonly listeners = new Set<Listener>();
  private readonly progressListeners = new Set<ProgressListener>();
  private readonly snapshots = new Map<string, TransferProgressSnapshot>();
  /** One auto-retry timer per download id — never occupies a worker slot. */
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Prevents duplicate schedule races before the timer is registered. */
  private readonly retryScheduling = new Set<string>();
  /** Soft-held by Wi-Fi Only / offline mid-transfer — eligible for auto-resume. */
  private readonly networkPolicyHeldIds = new Set<string>();
  private networkPolicyEnforcing = false;
  private recovering = false;
  /** Lifecycle recovery applied once per id this process (idempotent PATCH). */
  private readonly recoveredLifecycleIds = new Set<string>();
  private foregroundReconciling = false;
  /** Sync status hints for scheduler probe (avoid async I/O on drain). */
  private readonly statusHints = new Map<
    string,
    NonNullable<JobStatusProbe['status']>
  >();

  private ensureScheduler(): AdmissionScheduler {
    if (this.scheduler) {
      return this.scheduler;
    }

    this.scheduler = new AdmissionScheduler({
      probeJob: (downloadId) => this.probeJob(downloadId),
      onAdmit: (job) => this.admitWorker(job),
    });

    const settings = getDownloadSettings();
    this.scheduler.setPolicy({
      maxConcurrentDownloads: getEffectiveMaxConcurrentDownloads(),
      wifiOnly: settings.wifiOnly,
    });
    this.scheduler.setNetwork(getDownloadNetworkState());

    this.unsubSettings = subscribeDownloadSettings((next) => {
      this.scheduler?.setPolicy({
        maxConcurrentDownloads: normalizeMaxConcurrentDownloads(
          next.maxConcurrentDownloads,
        ),
        wifiOnly: next.wifiOnly,
      });
      void this.enforceNetworkPolicyOnActiveTransfers();
    });

    this.unsubNetwork = subscribeDownloadNetwork((network) => {
      this.scheduler?.setNetwork(network);
      void this.enforceNetworkPolicyOnActiveTransfers();
    });

    void startDownloadNetworkMonitor();
    return this.scheduler;
  }

  private probeJob(downloadId: string): JobStatusProbe | null {
    if (this.suppressedIds.has(downloadId)) {
      return { status: 'CANCELLED' };
    }
    if (this.retryTimers.has(downloadId) || this.retryScheduling.has(downloadId)) {
      return { status: 'FAILED', retryDelay: true };
    }
    const hint = this.statusHints.get(downloadId);
    if (hint) {
      return { status: hint };
    }
    return { status: 'QUEUED' };
  }

  private setStatusHint(
    downloadId: string,
    status: NonNullable<JobStatusProbe['status']> | null,
  ): void {
    if (status == null) {
      this.statusHints.delete(downloadId);
      return;
    }
    this.statusHints.set(downloadId, status);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  getSnapshot(downloadId: string): TransferProgressSnapshot | null {
    return this.snapshots.get(downloadId) ?? null;
  }

  getLocalUri(downloadId: string): string | null {
    return this.snapshots.get(downloadId)?.localUri ?? null;
  }

  /**
   * Re-probe a COMPLETED job's on-disk file and publish truthful local state.
   * Used by Details focus — does not block navigation or invent downloads.
   */
  async refreshCompletedLocalFile(downloadId: string): Promise<{
    usable: boolean;
    localUri: string | null;
  }> {
    const record = await getLocalRecord(downloadId);
    const snapshot = this.snapshots.get(downloadId);
    const status = record?.remoteStatus;
    if (status !== 'COMPLETED' && snapshot?.localState !== 'complete') {
      const uri = snapshot?.localUri ?? record?.localUri ?? null;
      return {
        usable: false,
        localUri: uri,
      };
    }

    const assessment = assessLocalFile({
      downloadId,
      localUri: snapshot?.localUri ?? record?.localUri ?? null,
      expectedBytes: record?.totalBytes ?? snapshot?.totalBytes ?? null,
    });

    if (assessment.presence === 'complete' && assessment.localUri) {
      if (record) {
        await upsertLocalRecord({
          ...record,
          localUri: assessment.localUri,
          localState: 'complete',
          bytesWritten: assessment.size,
          totalBytes: assessment.size,
          pauseState: null,
          errorCode: null,
          errorMessage: null,
        });
      }
      this.publishSnapshot(
        toTransferSnapshot(
          downloadId,
          {
            bytesWritten: assessment.size,
            totalBytes: assessment.size,
            progress: 100,
            bytesPerSecond: null,
            etaSeconds: 0,
          },
          assessment.localUri,
          'complete',
        ),
      );
      return { usable: true, localUri: assessment.localUri };
    }

    const localState =
      assessment.presence === 'missing' ? 'missing' : 'corrupt';
    if (record) {
      await upsertLocalRecord({
        ...record,
        localState,
        localUri: assessment.localUri,
        pauseState: null,
        errorCode:
          assessment.presence === 'missing'
            ? 'PARTIAL_FILE_MISSING'
            : 'FINAL_FILE_INVALID',
        errorMessage:
          assessment.presence === 'missing'
            ? 'Downloaded file is no longer available on this device.'
            : 'Downloaded file failed integrity checks.',
      });
    }
    this.publishSnapshot(
      toTransferSnapshot(
        downloadId,
        {
          bytesWritten: assessment.size,
          totalBytes: record?.totalBytes ?? null,
          progress: 100,
          bytesPerSecond: null,
          etaSeconds: null,
        },
        assessment.localUri,
        localState,
        assessment.presence === 'missing'
          ? 'PARTIAL_FILE_MISSING'
          : 'FINAL_FILE_INVALID',
        assessment.presence === 'missing'
          ? 'Downloaded file is no longer available on this device.'
          : 'Downloaded file failed integrity checks.',
      ),
    );
    return { usable: false, localUri: assessment.localUri };
  }

  /** Queue introspection for UI / diagnostics — immutable scheduler snapshot. */
  getQueueSnapshot(): QueueSnapshot {
    return this.ensureScheduler().getSnapshot();
  }

  subscribeQueue(listener: (snapshot: QueueSnapshot) => void): () => void {
    return this.ensureScheduler().subscribe(listener);
  }

  /** Request scheduler reevaluation (settings / network / capacity). */
  reevaluate(): void {
    this.ensureScheduler().requestDrain();
  }

  /**
   * Mid-transfer Wi-Fi Only / offline enforcement.
   * Progressive/multi-range → soft pause. HLS → soft hold (workspace kept).
   * Policy hold is not treated as network failure / retry storm.
   */
  private async enforceNetworkPolicyOnActiveTransfers(): Promise<void> {
    if (this.networkPolicyEnforcing) {
      return;
    }
    this.networkPolicyEnforcing = true;
    try {
      const settings = getDownloadSettings();
      const network = getDownloadNetworkState();
      const mustHold = shouldHoldActiveTransfer(settings.wifiOnly, network);

      if (!mustHold) {
        await this.resumeNetworkPolicyHolds();
        return;
      }

      const activeIds = [...this.workers.keys()];
      for (const downloadId of activeIds) {
        const worker = this.workers.get(downloadId);
        if (!worker?.isActive(downloadId)) {
          continue;
        }

        try {
          if (worker instanceof HlsTransferWorker) {
            const held = await worker.holdForNetworkPolicy(downloadId);
            if (held) {
              this.networkPolicyHeldIds.add(downloadId);
              this.setStatusHint(downloadId, 'PAUSED');
              hardeningLog('recovery.reconciled', {
                downloadId,
                reason: 'wifi_policy_hold_hls',
              });
            }
            continue;
          }

          // Progressive / multi-range — durable pause with resumeData.
          await this.pause(downloadId);
          this.networkPolicyHeldIds.add(downloadId);
          hardeningLog('recovery.reconciled', {
            downloadId,
            reason: 'wifi_policy_hold_progressive',
          });
        } catch (error) {
          hardeningLog(
            'recovery.rejected_transition',
            {
              downloadId,
              reason: 'wifi_policy_hold_failed',
              error: error instanceof Error ? error.message : 'hold_failed',
            },
            'warn',
          );
        }
      }
    } finally {
      this.networkPolicyEnforcing = false;
    }
  }

  private async resumeNetworkPolicyHolds(): Promise<void> {
    if (this.networkPolicyHeldIds.size === 0) {
      return;
    }
    if (!isAutoResumeEnabled()) {
      return;
    }

    const settings = getDownloadSettings();
    const network = getDownloadNetworkState();
    if (shouldHoldActiveTransfer(settings.wifiOnly, network)) {
      return;
    }

    const ids = [...this.networkPolicyHeldIds];
    for (const downloadId of ids) {
      this.networkPolicyHeldIds.delete(downloadId);
      try {
        await this.resume(downloadId);
        hardeningLog('recovery.reconciled', {
          downloadId,
          reason: 'wifi_policy_resume',
        });
      } catch (error) {
        hardeningLog(
          'recovery.rejected_transition',
          {
            downloadId,
            reason: 'wifi_policy_resume_failed',
            error: error instanceof Error ? error.message : 'resume_failed',
          },
          'warn',
        );
      }
    }
  }

  getJobEvidence(downloadId: string): {
    hasActiveWorker: boolean;
    isQueued: boolean;
    isSuppressed: boolean;
    executionOwner: 'JS' | 'ANDROID_NATIVE' | 'NONE';
    isRetryScheduled: boolean;
  } {
    const scheduler = this.ensureScheduler();
    const worker = this.workers.get(downloadId);
    const coordinator = getDownloadExecutionCoordinator();
    return {
      hasActiveWorker: Boolean(
        worker && (worker.isActive(downloadId) || this.workers.has(downloadId)),
      ),
      isQueued: scheduler.isPending(downloadId),
      isSuppressed: this.suppressedIds.has(downloadId),
      executionOwner: coordinator.getOwner(downloadId),
      isRetryScheduled:
        this.retryTimers.has(downloadId) || this.retryScheduling.has(downloadId),
    };
  }

  /** Platform FGS / ledger snapshot for UI + diagnostics. */
  getBackgroundExecutionLedger() {
    return getDownloadExecutionCoordinator().getLedgerSnapshot();
  }

  /**
   * True when Android FGS is actually protecting work (not iOS/noop/ledger-only).
   * Cached from last native flush; never claims background on UNAVAILABLE platforms.
   */
  isForegroundServiceActive(): boolean {
    const coordinator = getDownloadExecutionCoordinator();
    if (coordinator.getLastServiceError()) {
      return false;
    }
    return coordinator.isNativeForegroundServiceRunning();
  }

  async getNativeExecutionSnapshot() {
    return getDownloadExecutionCoordinator().getNativeSnapshot();
  }

  async enqueue(input: EnqueueInput): Promise<void> {
    if (!isSafeHttpUrl(input.sourceUrl)) {
      throw new DownloadEngineError('INVALID_RESOURCE', 'Invalid download URL.');
    }

    // HLS playlists are a first-class strategy — do not reject here.
    // Encrypted/live/malformed playlists fail inside HlsTransferWorker.

    const scheduler = this.ensureScheduler();

    if (this.locks.has(input.id) || scheduler.has(input.id)) {
      return;
    }

    if (this.workers.has(input.id)) {
      // One download id → at most one active worker.
      return;
    }

    const existing = await getLocalRecord(input.id);
    if (existing?.localState === 'complete' && existing.localUri) {
      const file = new File(existing.localUri);
      const verified = verifyCompletedFile(file, existing.totalBytes, {
        downloadId: input.id,
      });
      if (verified.ok) {
        this.setStatusHint(input.id, 'COMPLETED');
        return;
      }
    }

    if (
      existing?.remoteStatus === 'COMPLETED' ||
      existing?.remoteStatus === 'CANCELLED'
    ) {
      this.setStatusHint(input.id, existing.remoteStatus);
      return;
    }

    if (existing?.remoteStatus === 'FAILED') {
      // FAILED must enter only via retry()/scheduled retry (status already QUEUED).
      this.setStatusHint(input.id, 'FAILED');
      return;
    }

    // A prior cancel/remove suppresses late startWorker; a deliberate enqueue
    // of the same id (e.g. recovery resume) clears that suppression.
    this.suppressedIds.delete(input.id);

    if (input.preferPaused) {
      await upsertLocalRecord({
        downloadId: input.id,
        sourceUrl: input.sourceUrl,
        fileName: input.fileName,
        expectedFileSize: input.fileSize,
        localUri: existing?.localUri ?? null,
        localState: 'paused',
        bytesWritten: existing?.bytesWritten ?? 0,
        totalBytes: existing?.totalBytes ?? null,
        pauseState: existing?.pauseState ?? null,
        rangeValidators: existing?.rangeValidators ?? null,
        generation: existing?.generation ?? 0,
        errorCode: null,
        errorMessage: null,
        remoteStatus: 'PAUSED',
        ...defaultRetryFields(existing),
        updatedAt: new Date().toISOString(),
      });
      this.setStatusHint(input.id, 'PAUSED');
      return;
    }

    await upsertLocalRecord({
      downloadId: input.id,
      sourceUrl: input.sourceUrl,
      fileName: input.fileName,
      expectedFileSize: input.fileSize,
      localUri: existing?.localUri ?? null,
      localState: 'not_started',
      bytesWritten: existing?.bytesWritten ?? 0,
      totalBytes: existing?.totalBytes ?? null,
      pauseState: null,
      rangeValidators: existing?.rangeValidators ?? null,
      generation: existing?.generation ?? 0,
      errorCode: null,
      errorMessage: null,
      remoteStatus: 'QUEUED',
      ...defaultRetryFields(existing),
      nextRetryAt: null,
      updatedAt: new Date().toISOString(),
    });

    this.setStatusHint(input.id, 'QUEUED');
    scheduler.enqueue({
      id: input.id,
      sourceUrl: input.sourceUrl,
      fileName: input.fileName,
      fileSize: input.fileSize,
      title: input.title,
    });
  }

  async pause(downloadId: string): Promise<void> {
    if (this.locks.has(downloadId)) {
      return;
    }
    this.locks.add(downloadId);
    try {
      const worker = this.workers.get(downloadId);
      if (worker && (worker.isActive(downloadId) || this.workers.has(downloadId))) {
        // Progressive: native pause. HLS: throws RESUME_UNSUPPORTED (honest).
        // Retry briefly when DOWNLOADING is visible but the DownloadTask is still
        // binding (should be rare after worker starts transfer before status sync).
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const ok = await worker.pause(downloadId);
          if (ok) {
            // Wait for run() to settle + persist pauseState before returning.
            // Callers/UI must not treat PAUSED as durable until resumeData exists.
            for (let wait = 0; wait < 50; wait += 1) {
              if (!this.workers.has(downloadId)) {
                break;
              }
              await new Promise<void>((resolve) => {
                setTimeout(resolve, 40);
              });
            }
            const settled = await getLocalRecord(downloadId);
            if (
              settled &&
              !isPlaylistOrStreamUrl(settled.sourceUrl) &&
              !settled.pauseState?.resumeData &&
              !hasResumableMultiRange(settled.multiRange)
            ) {
              throw new DownloadEngineError(
                'PAUSE_FAILED',
                'Couldn’t pause this download right now. Try again in a moment.',
              );
            }
            this.setStatusHint(downloadId, 'PAUSED');
            return;
          }
          if (!this.workers.has(downloadId) || !worker.isActive(downloadId)) {
            break;
          }
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 30);
          });
        }

        if (worker.isActive(downloadId)) {
          throw new DownloadEngineError(
            'PAUSE_FAILED',
            'Couldn’t pause this download right now. Try again in a moment.',
          );
        }
      }

      const existing = await getLocalRecord(downloadId);

      // Active DOWNLOADING without a live worker cannot form a clean pause.
      if (
        existing &&
        (existing.remoteStatus === 'DOWNLOADING' ||
          existing.localState === 'transferring') &&
        !existing.pauseState?.resumeData &&
        !hasResumableMultiRange(existing.multiRange) &&
        !this.workers.has(downloadId)
      ) {
        throw new DownloadEngineError(
          'WORKER_NOT_FOUND',
          'Couldn’t pause this download right now. Try again in a moment.',
        );
      }

      // Queued / not started — release pending slot without a native task.
      this.ensureScheduler().cancelPending(downloadId);
      if (existing) {
        await upsertLocalRecord({
          ...existing,
          rangeValidators: existing.rangeValidators ?? null,
          localState: 'paused',
          remoteStatus:
            existing.remoteStatus === 'DOWNLOADING' ? 'PAUSED' : existing.remoteStatus,
          pauseState: existing.pauseState,
        });
      }
      // Backend forbids QUEUED → PAUSED. Only PATCH when already DOWNLOADING.
      if (existing?.remoteStatus === 'DOWNLOADING') {
        await syncStatusImmediate(downloadId, 'PAUSED');
      }
      this.emit({ type: 'status', downloadId, status: 'PAUSED' });
      // Pending pause frees no active slot; still pump in case of races.
      this.pump();
    } finally {
      this.locks.delete(downloadId);
    }
  }

  async resume(downloadId: string): Promise<void> {
    if (this.locks.has(downloadId)) {
      hardeningLog('download.resume_failed', {
        downloadId,
        errorCode: 'RESUME_STATE_CONFLICT',
        workerState: 'lock_held',
      }, 'warn');
      return;
    }
    this.locks.add(downloadId);
    let enqueueInput: SchedulerJobInput | null = null;
    let resumeOffset: number | null = null;
    try {
      hardeningLog('download.resume_requested', {
        downloadId,
        status: this.statusHints.get(downloadId) ?? null,
      });

      // Pause returns as soon as native pause is requested, but the worker stays
      // mapped until settle finishes. Wait for that release before re-enqueueing.
      if (this.workers.has(downloadId)) {
        for (let attempt = 0; attempt < 50; attempt += 1) {
          if (!this.workers.has(downloadId)) {
            break;
          }
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 40);
          });
        }
        if (this.workers.has(downloadId)) {
          hardeningLog('download.resume_failed', {
            downloadId,
            errorCode: 'RESUME_FAILED',
            workerState: 'still_active',
          }, 'warn');
          throw new DownloadEngineError(
            'RESUME_FAILED',
            'Unable to resume this download.',
          );
        }
      }

      // Clear ghost pending/active ownership from a prior failed resume before
      // validating — release() frees capacity that cancelPending alone cannot.
      if (this.ensureScheduler().has(downloadId)) {
        this.ensureScheduler().cancelPending(downloadId);
        this.ensureScheduler().release(downloadId);
      }

      let existing = await getLocalRecord(downloadId);
      if (!existing) {
        hardeningLog('download.resume_failed', {
          downloadId,
          errorCode: 'RESUME_STATE_MISSING',
        }, 'warn');
        throw new DownloadEngineError(
          'RESUME_STATE_MISSING',
          'Unable to resume this download.',
        );
      }

      if (existing.localState === 'complete') {
        return;
      }

      if (
        existing.remoteStatus === 'CANCELLED' ||
        existing.remoteStatus === 'COMPLETED'
      ) {
        throw new DownloadEngineError(
          'RESUME_UNSUPPORTED',
          'This download can no longer be resumed.',
        );
      }

      if (!isSafeHttpUrl(existing.sourceUrl)) {
        throw new DownloadEngineError(
          'INVALID_RESOURCE',
          'Invalid download URL.',
        );
      }

      hardeningLog('download.resume_validating', {
        downloadId,
        status: existing.remoteStatus,
        offset: existing.bytesWritten,
        expectedSize: existing.totalBytes ?? existing.expectedFileSize,
      });

      if (isPlaylistOrStreamUrl(existing.sourceUrl)) {
        // User pause is unsupported for HLS. Network-policy soft-hold persists
        // PAUSED + hlsTransfer workspace — that path may resume.
        if (!existing.hlsTransfer) {
          throw new DownloadEngineError(
            'RESUME_UNSUPPORTED',
            'Pause isn’t supported for HLS downloads.',
          );
        }
      } else if (
        !existing.pauseState?.resumeData &&
        !hasResumableMultiRange(existing.multiRange)
      ) {
        // Reconstruct durable pause from on-disk partial when checkpoint was lost
        // but bytes remain (authoritative file size → Range offset).
        const destination = resolveDestinationFile(
          existing.downloadId,
          existing.fileName,
          { sourceUrl: existing.sourceUrl },
        );
        const actualPartialSize = readPartialFileSize(destination);
        const reconstructed = buildDurablePauseState(
          existing.sourceUrl,
          destination,
          existing.pauseState,
          actualPartialSize,
        );
        hardeningLog('download.resume_partial_state', {
          downloadId,
          offset: existing.bytesWritten,
          actualPartialSize,
          expectedSize: existing.totalBytes,
        });
        if (reconstructed?.resumeData) {
          existing = {
            ...existing,
            pauseState: reconstructed,
            bytesWritten: Math.max(
              existing.bytesWritten,
              parseAndroidResumeOffset(reconstructed.resumeData) ??
                actualPartialSize,
            ),
            localUri: destination.uri,
          };
          await upsertLocalRecord(existing);
        } else {
          hardeningLog('download.resume_failed', {
            downloadId,
            errorCode: 'RESUME_STATE_MISSING',
            actualPartialSize,
          }, 'warn');
          throw new DownloadEngineError(
            'RESUME_STATE_MISSING',
            'Unable to resume this download.',
          );
        }
      }

      if (existing.pauseState?.resumeData) {
        const destination = resolveDestinationFile(
          existing.downloadId,
          existing.fileName,
          { sourceUrl: existing.sourceUrl },
        );
        const actualPartialSize = readPartialFileSize(destination);
        const checkpointOffset =
          parseAndroidResumeOffset(existing.pauseState.resumeData) ??
          existing.bytesWritten;
        // On-disk size is authoritative for Android numeric resume.
        const safeOffset =
          actualPartialSize > 0 ? actualPartialSize : checkpointOffset;
        resumeOffset = safeOffset > 0 ? safeOffset : null;
        if (
          actualPartialSize > 0 &&
          parseAndroidResumeOffset(existing.pauseState.resumeData) != null &&
          actualPartialSize !==
            parseAndroidResumeOffset(existing.pauseState.resumeData)
        ) {
          existing = {
            ...existing,
            pauseState: {
              ...existing.pauseState,
              resumeData: String(actualPartialSize),
              fileUri: destination.uri,
            },
            bytesWritten: actualPartialSize,
          };
          hardeningLog('download.resume_partial_state', {
            downloadId,
            offset: checkpointOffset,
            actualPartialSize,
            errorCode: 'CHECKPOINT_MISMATCH',
          });
        } else {
          hardeningLog('download.resume_partial_state', {
            downloadId,
            offset: resumeOffset,
            actualPartialSize,
            expectedSize: existing.totalBytes,
          });
        }
      } else if (hasResumableMultiRange(existing.multiRange)) {
        resumeOffset = sumMultiRangeDownloaded(existing.multiRange!);
        hardeningLog('download.resume_partial_state', {
          downloadId,
          offset: resumeOffset,
          expectedSize: existing.multiRange?.contentLength,
        });
      }

      // Manual Resume must succeed regardless of Auto Resume preference.
      this.networkPolicyHeldIds.delete(downloadId);
      this.suppressedIds.delete(downloadId);

      // Persist QUEUED BEFORE enqueue/drain. enqueue() triggers requestDrain()
      // immediately; admitWorker rejects locks.has and remoteStatus===PAUSED
      // and does not requeue — so enqueue-under-lock permanently orphans resume.
      this.setStatusHint(downloadId, 'QUEUED');
      await upsertLocalRecord({
        ...existing,
        rangeValidators: existing.rangeValidators ?? null,
        localState: 'not_started',
        remoteStatus: 'QUEUED',
        errorCode: null,
        errorMessage: null,
        pauseState: existing.pauseState,
        multiRange: existing.multiRange,
        bytesWritten: existing.bytesWritten,
      });

      enqueueInput = {
        id: existing.downloadId,
        sourceUrl: existing.sourceUrl,
        fileName: existing.fileName,
        fileSize: existing.expectedFileSize,
      };
    } finally {
      // CRITICAL: release the resume lock BEFORE enqueue/pump.
      // enqueue → drain → admitWorker bails on locks.has and drops the job.
      this.locks.delete(downloadId);
    }

    if (!enqueueInput) {
      return;
    }

    // Re-assert QUEUED immediately before enqueue so a late afterWorkerSettled
    // from the prior pause cannot leave probe status as PAUSED.
    this.setStatusHint(downloadId, 'QUEUED');

    const enqueued = this.ensureScheduler().enqueue(enqueueInput);
    hardeningLog('download.resume_admission', {
      downloadId,
      status: this.statusHints.get(downloadId) ?? null,
      offset: resumeOffset,
      workerState: enqueued ? 'enqueued' : 'rejected',
      errorCode: enqueued ? null : 'QUEUE_ADMISSION_FAILED',
    }, enqueued ? 'info' : 'warn');
    if (!enqueued) {
      throw new DownloadEngineError(
        'QUEUE_ADMISSION_FAILED',
        'Unable to resume this download.',
      );
    }

    this.pump();

    hardeningLog('download.resume_worker_started', {
      downloadId,
      offset: resumeOffset,
      status: this.statusHints.get(downloadId) ?? null,
    });

    // Only surface QUEUED when the job is genuinely waiting for a concurrency slot.
    // Free-slot resumes start immediately and the worker emits DOWNLOADING.
    const snapshot = this.getQueueSnapshot();
    if (snapshot.pending.some((item) => item.downloadId === downloadId)) {
      this.emit({ type: 'status', downloadId, status: 'QUEUED' });
    }
  }

  async cancel(downloadId: string): Promise<void> {
    this.networkPolicyHeldIds.delete(downloadId);
    if (this.locks.has(downloadId)) {
      return;
    }
    this.locks.add(downloadId);
    // Suppress BEFORE removing from queue so an in-flight admitWorker bails.
    this.suppressedIds.add(downloadId);
    this.clearRetryTimer(downloadId);
    try {
      const worker = this.workers.get(downloadId);
      this.ensureScheduler().cancelPending(downloadId);

      // Abort first so late completion callbacks cannot mark COMPLETED.
      if (worker?.isActive(downloadId) || this.workers.has(downloadId)) {
        await worker?.cancel(downloadId);
      }

      await cleanupCancelledDownload(downloadId);
      await cleanupHlsWorkspace(downloadId);
      await cleanupMultiRangeWorkspace(downloadId);
      await removeLocalRecord(downloadId);
      this.snapshots.delete(downloadId);
      this.workers.delete(downloadId);
      this.ensureScheduler().release(downloadId);
      this.setStatusHint(downloadId, 'CANCELLED');
      await syncStatusImmediate(downloadId, 'CANCELLED', {
        errorMessage: null,
        workerState: 'CANCELLED',
      });
      this.emit({ type: 'cancelled', downloadId });
      this.emit({ type: 'status', downloadId, status: 'CANCELLED' });
      this.pump();
    } finally {
      this.locks.delete(downloadId);
    }
  }

  /**
   * Canonical manual Retry: FAILED → QUEUED → DOWNLOADING (same download id).
   * Resets the auto-retry cycle so the user can recover after budget exhaustion.
   */
  async retry(downloadId: string): Promise<void> {
    if (this.locks.has(downloadId)) {
      return;
    }
    this.locks.add(downloadId);
    let enqueueInput: SchedulerJobInput | null = null;
    try {
      this.clearRetryTimer(downloadId);

      if (this.workers.has(downloadId)) {
        throw new DownloadEngineError(
          'TRANSFER_INTERRUPTED',
          'Unable to retry this download right now.',
        );
      }

      if (this.ensureScheduler().has(downloadId)) {
        this.ensureScheduler().cancelPending(downloadId);
        this.ensureScheduler().release(downloadId);
      }

      const existing = await getLocalRecord(downloadId);
      if (!existing) {
        throw new DownloadEngineError(
          'WORKER_NOT_FOUND',
          'Unable to retry this download.',
        );
      }

      if (
        existing.remoteStatus === 'CANCELLED' ||
        existing.localState === 'deleted'
      ) {
        throw new DownloadEngineError(
          'INVALID_RESOURCE',
          'This download can no longer be retried.',
        );
      }

      if (existing.remoteStatus === 'COMPLETED' || existing.localState === 'complete') {
        return;
      }

      if (
        existing.remoteStatus !== 'FAILED' &&
        existing.localState !== 'failed' &&
        existing.localState !== 'corrupt' &&
        existing.localState !== 'missing'
      ) {
        throw new DownloadEngineError(
          'TRANSFER_INTERRUPTED',
          'Only failed downloads can be retried.',
        );
      }

      if (!isManualRetryAllowed(existing.errorCode)) {
        throw new DownloadEngineError(
          existing.errorCode ?? 'INVALID_RESOURCE',
          existing.errorMessage ?? 'This download can’t be retried.',
        );
      }

      const prepared = await this.prepareRetryPartial(existing);

      this.suppressedIds.delete(downloadId);

      // Persist QUEUED + release lock BEFORE enqueue (same race as resume).
      this.setStatusHint(downloadId, 'QUEUED');
      await upsertLocalRecord({
        ...prepared,
        localState: 'not_started',
        remoteStatus: 'QUEUED',
        errorCode: null,
        errorMessage: null,
        retryCount: 0,
        maxRetries: DOWNLOAD_ENGINE.maxAutoRetryAttempts,
        retryEligible: true,
        lastAttemptAt: new Date().toISOString(),
        nextRetryAt: null,
      });

      try {
        await syncStatusImmediate(downloadId, 'QUEUED', {
          errorCode: null,
          errorMessage: null,
        });
      } catch {
        // Local queue remains authoritative if backend sync races.
      }

      this.emit({ type: 'status', downloadId, status: 'QUEUED' });
      enqueueInput = {
        id: prepared.downloadId,
        sourceUrl: prepared.sourceUrl,
        fileName: prepared.fileName,
        fileSize: prepared.expectedFileSize,
      };
    } finally {
      this.locks.delete(downloadId);
    }

    if (!enqueueInput) {
      return;
    }

    const enqueued = this.ensureScheduler().enqueue(enqueueInput);
    if (!enqueued) {
      throw new DownloadEngineError(
        'TRANSFER_INTERRUPTED',
        'Unable to retry this download.',
      );
    }

    this.pump();

    const snapshot = this.getQueueSnapshot();
    if (snapshot.pending.some((item) => item.downloadId === downloadId)) {
      this.emit({ type: 'status', downloadId, status: 'QUEUED' });
    }
  }

  async remove(downloadId: string): Promise<void> {
    this.suppressedIds.add(downloadId);
    this.clearRetryTimer(downloadId);
    this.ensureScheduler().cancelPending(downloadId);
    const worker = this.workers.get(downloadId);
    if (worker?.isActive(downloadId)) {
      await worker.cancel(downloadId);
    }
    clearSyncState(downloadId);
    await cleanupHlsWorkspace(downloadId);
    await cleanupMultiRangeWorkspace(downloadId);
    await deleteDownloadFiles(downloadId);
    await removeLocalRecord(downloadId);
    this.snapshots.delete(downloadId);
    this.workers.delete(downloadId);
    this.pump();
    // Notify Library / playback bridges after local truth is gone (idempotent).
    this.emit({ type: 'removed', downloadId });
  }

  /**
   * Reconcile local records after process start.
   * Uses decideRecoveryState — does not invent transfers or auto-resume.
   * Platform FGS registry is reconciled before recovery enqueue.
   */
  async recover(): Promise<void> {
    if (this.recovering) {
      return;
    }
    this.recovering = true;
    hardeningLog('recovery.start', {});
    try {
      downloadAppLifecycle.ensureAttached();
      // Bootstrap order: native snapshot → align ledger to JS workers → recovery.
      await getDownloadExecutionCoordinator().reconcile({
        jsActiveIds: [...this.workers.keys()],
      });

      const records = await listLocalRecords();

      for (const record of records) {
        await this.applyRecoveryForRecord(record, { allowEnqueue: true });
      }
      hardeningLog('recovery.reconciled', { count: records.length });
    } finally {
      this.recovering = false;
    }
  }

  /**
   * Lightweight foreground check — stale DOWNLOADING without worker only.
   * Does not rebuild the full queue or duplicate workers.
   * Queries native FGS snapshot first (idempotent; Model B JS owns transfer).
   */
  async reconcileForeground(): Promise<void> {
    if (this.recovering || this.foregroundReconciling) {
      return;
    }
    this.foregroundReconciling = true;
    try {
      await getDownloadExecutionCoordinator().reconcile({
        jsActiveIds: [...this.workers.keys()],
      });

      const records = await listLocalRecords();
      for (const record of records) {
        if (
          record.remoteStatus !== 'DOWNLOADING' &&
          record.localState !== 'transferring'
        ) {
          continue;
        }
        if (this.workers.has(record.downloadId)) {
          continue;
        }
        // Native-only ID without JS worker cannot continue transfer in Model B.
        await this.applyRecoveryForRecord(record, { allowEnqueue: false });
      }
    } finally {
      this.foregroundReconciling = false;
    }
  }

  private inspectRecoveryEvidence(record: LocalDownloadRecord): {
    decision: RecoveryDecision;
    destination: File;
    durablePause: ReturnType<typeof buildDurablePauseState>;
    assessment: ReturnType<typeof assessLocalFile>;
  } {
    const isHls = isPlaylistOrStreamUrl(record.sourceUrl);
    const hasActiveWorker = this.workers.has(record.downloadId);
    const isQueued = this.ensureScheduler().has(record.downloadId);
    const isSuppressed = this.suppressedIds.has(record.downloadId);

    const destination = resolveDestinationFile(
      record.downloadId,
      record.fileName,
      { sourceUrl: record.sourceUrl },
    );

    const assessment = assessLocalFile({
      downloadId: record.downloadId,
      localUri: record.localUri ?? destination.uri,
      expectedBytes: record.totalBytes,
      preferPartial: true,
    });

    const partialSize =
      assessment.presence === 'partial'
        ? assessment.size
        : readPartialFileSize(destination);
    const hasMultiRangePartial =
      !isHls && hasResumableMultiRange(record.multiRange);
    const hasHlsWorkspace =
      isHls &&
      record.hlsTransfer != null &&
      record.hlsTransfer.completedSegments >= 0 &&
      record.hlsTransfer.totalSegments > 0;
    const hasValidPartial =
      (!isHls && partialSize > 0) || hasMultiRangePartial || hasHlsWorkspace;

    let durablePause = null as ReturnType<typeof buildDurablePauseState>;
    if (hasValidPartial && !hasMultiRangePartial) {
      durablePause = buildDurablePauseState(
        record.sourceUrl,
        destination,
        record.pauseState,
        partialSize,
      );
    } else if (
      record.pauseState?.resumeData &&
      parseAndroidResumeOffset(record.pauseState.resumeData) == null
    ) {
      // Opaque iOS resume blob may exist without on-disk bytes yet.
      durablePause = buildDurablePauseState(
        record.sourceUrl,
        destination,
        record.pauseState,
        0,
      );
    }

    const canResume =
      Boolean(durablePause?.resumeData) || hasMultiRangePartial;

    let hasVerifiedFinalFile = false;
    let completedFileMissing = false;
    if (
      record.remoteStatus === 'COMPLETED' ||
      record.localState === 'complete'
    ) {
      if (record.localUri) {
        const file = new File(record.localUri);
        const verified = verifyCompletedFile(file, record.totalBytes, {
          downloadId: record.downloadId,
        });
        hasVerifiedFinalFile = verified.ok;
        completedFileMissing = !verified.ok;
      } else {
        completedFileMissing = true;
      }
    }

    const decision = decideRecoveryState({
      remoteStatus: record.remoteStatus,
      localState: record.localState,
      hasActiveWorker,
      isQueued,
      isSuppressed,
      isHls,
      hasValidPartial: hasValidPartial || canResume,
      canResume,
      hasVerifiedFinalFile,
      completedFileMissing,
      sourceUrlSafe: isSafeHttpUrl(record.sourceUrl),
    });

    return { decision, destination, durablePause, assessment };
  }

  private async applyRecoveryForRecord(
    record: LocalDownloadRecord,
    options: { allowEnqueue: boolean },
  ): Promise<void> {
    const id = record.downloadId;
    const { decision, destination, durablePause, assessment } =
      this.inspectRecoveryEvidence(record);

    if (__DEV__) {
      console.info(
        JSON.stringify({
          scope: 'download-recovery',
          downloadId: id,
          remoteStatus: record.remoteStatus,
          localState: record.localState,
          workerPresent: this.workers.has(id),
          retryCount: record.retryCount,
          recoveryDecision: decision.action,
          reason: decision.reason,
        }),
      );
    }

    switch (decision.action) {
      case 'KEEP_CANCELLED': {
        this.suppressedIds.add(id);
        this.clearRetryTimer(id);
        this.ensureScheduler().cancelPending(id);
        await cleanupHlsWorkspace(id);
        await cleanupMultiRangeWorkspace(id);
        await removeLocalRecord(id);
        this.snapshots.delete(id);
        return;
      }

      case 'KEEP_DOWNLOADING':
      case 'NO_ACTION':
        return;

      case 'KEEP_COMPLETED': {
        this.publishSnapshot(
          toTransferSnapshot(
            id,
            {
              bytesWritten: record.totalBytes ?? record.bytesWritten,
              totalBytes: record.totalBytes,
              progress: 100,
              bytesPerSecond: null,
              etaSeconds: 0,
            },
            record.localUri,
            'complete',
          ),
        );
        return;
      }

      case 'MARK_LOCAL_UNAVAILABLE': {
        const localState =
          assessment.presence === 'missing' || !record.localUri
            ? 'missing'
            : 'corrupt';
        await upsertLocalRecord({
          ...record,
          localState,
          remoteStatus: 'COMPLETED',
        });
        this.publishSnapshot(
          toTransferSnapshot(
            id,
            {
              bytesWritten: record.bytesWritten,
              totalBytes: record.totalBytes,
              progress: 0,
              bytesPerSecond: null,
              etaSeconds: null,
            },
            record.localUri,
            localState,
            'FINAL_FILE_INVALID',
            localState === 'missing'
              ? 'Downloaded file is no longer available on this device.'
              : 'Downloaded file failed integrity checks.',
          ),
        );
        return;
      }

      case 'KEEP_PAUSED': {
        if (durablePause && durablePause !== record.pauseState) {
          await upsertLocalRecord({
            ...record,
            localState: 'paused',
            remoteStatus: 'PAUSED',
            pauseState: durablePause,
            localUri: destination.uri,
            bytesWritten:
              parseAndroidResumeOffset(durablePause.resumeData) ??
              record.bytesWritten,
          });
        }
        return;
      }

      case 'KEEP_FAILED': {
        if (
          shouldScheduleAutoRetry({
            retryEligible: record.retryEligible,
            retryCount: record.retryCount,
            errorCode: record.errorCode,
          })
        ) {
          const due = record.nextRetryAt
            ? Date.parse(record.nextRetryAt)
            : NaN;
          const delay = Number.isFinite(due)
            ? Math.max(0, due - Date.now())
            : computeRetryDelayMs(record.retryCount);
          this.scheduleAutoRetry(id, delay);
        }
        return;
      }

      case 'RECOVER_TO_PAUSED': {
        if (this.recoveredLifecycleIds.has(id)) {
          return;
        }
        this.recoveredLifecycleIds.add(id);
        this.clearRetryTimer(id);

        const isHls = isPlaylistOrStreamUrl(record.sourceUrl);
        // Preserve HLS segment workspace for network-policy / resumable holds.
        // Only wipe when there is no recoverable workspace evidence.
        if (isHls && !record.hlsTransfer) {
          await cleanupHlsWorkspace(id);
        }

        const pauseState = isHls
          ? null
          : durablePause ??
            buildDurablePauseState(
              record.sourceUrl,
              destination,
              record.pauseState,
              record.bytesWritten,
            );

        await upsertLocalRecord({
          ...record,
          localState: 'paused',
          remoteStatus: 'PAUSED',
          pauseState,
          localUri: isHls ? record.localUri : destination.uri,
          bytesWritten: isHls
            ? record.hlsTransfer?.downloadedBytes ?? record.bytesWritten
            : parseAndroidResumeOffset(pauseState?.resumeData) ??
              record.bytesWritten,
          errorCode: null,
          errorMessage: null,
          hlsTransfer: isHls ? record.hlsTransfer : record.hlsTransfer,
        });

        if (record.remoteStatus === 'DOWNLOADING') {
          try {
            await syncStatusImmediate(id, 'PAUSED');
          } catch {
            // Sync layer retries; local PAUSED remains authoritative.
          }
        }

        this.emit({ type: 'status', downloadId: id, status: 'PAUSED' });

        const autoResume = isAutoResumeEnabled();
        const canResumeProgressive = Boolean(pauseState?.resumeData);
        const canResumeHls = Boolean(record.hlsTransfer);
        const eligible =
          options.allowEnqueue &&
          autoResume &&
          (canResumeProgressive || canResumeHls) &&
          !this.workers.has(id) &&
          !this.ensureScheduler().has(id);

        if (eligible) {
          try {
            await this.resume(id);
          } catch {
            // Leave PAUSED for manual resume.
          }
        }
        return;
      }

      case 'RECOVER_TO_FAILED': {
        if (this.recoveredLifecycleIds.has(id)) {
          return;
        }
        this.recoveredLifecycleIds.add(id);
        this.clearRetryTimer(id);
        this.ensureScheduler().cancelPending(id);

        const errorCode = decision.errorCode ?? 'TRANSFER_INTERRUPTED';
        const errorMessage =
          decision.errorMessage ?? 'The download was interrupted.';

        await upsertLocalRecord({
          ...record,
          localState: 'failed',
          remoteStatus: 'FAILED',
          pauseState: null,
          errorCode: errorCode as LocalDownloadRecord['errorCode'],
          errorMessage,
          retryEligible: isManualRetryAllowed(
            errorCode as LocalDownloadRecord['errorCode'],
          ),
        });

        try {
          await syncStatusImmediate(id, 'FAILED', {
            errorCode,
            errorMessage,
          });
        } catch {
          // ignore
        }

        this.emit({
          type: 'failed',
          downloadId: id,
          code: errorCode as never,
          message: errorMessage,
        });
        this.emit({
          type: 'status',
          downloadId: id,
          status: 'FAILED',
          errorMessage,
        });
        return;
      }

      case 'REENQUEUE': {
        if (!options.allowEnqueue) {
          return;
        }
        if (!isAutoResumeEnabled()) {
          return;
        }
        if (this.ensureScheduler().has(id) || this.workers.has(id) || this.suppressedIds.has(id)) {
          return;
        }
        if (this.recoveredLifecycleIds.has(`enqueue:${id}`)) {
          return;
        }
        this.recoveredLifecycleIds.add(`enqueue:${id}`);

        this.setStatusHint(id, 'QUEUED');
        const enqueued = this.ensureScheduler().enqueue({
          id: record.downloadId,
          sourceUrl: record.sourceUrl,
          fileName: record.fileName,
          fileSize: record.expectedFileSize,
        });
        if (!enqueued) {
          return;
        }

        await upsertLocalRecord({
          ...record,
          localState: 'not_started',
          remoteStatus: 'QUEUED',
          errorCode: null,
          errorMessage: null,
        });
        this.emit({ type: 'status', downloadId: id, status: 'QUEUED' });
        this.pump();
        return;
      }

      default:
        return;
    }
  }

  private clearRetryTimer(downloadId: string): void {
    const timer = this.retryTimers.get(downloadId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(downloadId);
    }
    this.retryScheduling.delete(downloadId);
  }

  private scheduleAutoRetry(downloadId: string, delayMs?: number): void {
    if (
      this.retryTimers.has(downloadId) ||
      this.retryScheduling.has(downloadId)
    ) {
      return;
    }
    if (this.suppressedIds.has(downloadId) || this.ensureScheduler().has(downloadId)) {
      return;
    }

    // Do not arm a new timer while offline / waiting for Wi-Fi — defer.
    {
      const settings = getDownloadSettings();
      const network = getDownloadNetworkState();
      const admission = evaluateNetworkAdmission(settings.wifiOnly, network);
      if (!admission.allowed && delayMs === undefined) {
        // Still record nextRetryAt intent but use a deferred timer.
        delayMs = computeRetryDelayMs(0);
        hardeningLog('retry.scheduled', {
          downloadId,
          deferred: true,
          reason: admission.reason,
        });
      }
    }

    this.retryScheduling.add(downloadId);
    void (async () => {
      try {
        const record = await getLocalRecord(downloadId);
        if (
          !record ||
          record.remoteStatus !== 'FAILED' ||
          !shouldScheduleAutoRetry({
            retryEligible: record.retryEligible,
            retryCount: record.retryCount,
            errorCode: record.errorCode,
          })
        ) {
          return;
        }

        const delay = applyRetryJitter(
          delayMs ?? computeRetryDelayMs(record.retryCount),
        );
        const nextRetryAt = new Date(Date.now() + delay).toISOString();
        await upsertLocalRecord({
          ...record,
          nextRetryAt,
          lastAttemptAt: record.lastAttemptAt ?? new Date().toISOString(),
        });

        try {
          await syncStatusImmediate(downloadId, 'FAILED', {
            workerState: 'RETRY_WAIT',
            errorCode: record.errorCode,
            errorMessage: record.errorMessage,
          });
        } catch {
          // Non-fatal — timer still owns local retry scheduling.
        }

        if (this.retryTimers.has(downloadId)) {
          return;
        }

        const timer = setTimeout(() => {
          this.retryTimers.delete(downloadId);
          void this.executeScheduledRetry(downloadId);
        }, delay);
        this.retryTimers.set(downloadId, timer);
      } finally {
        this.retryScheduling.delete(downloadId);
      }
    })();
  }

  private async executeScheduledRetry(downloadId: string): Promise<void> {
    if (
      this.locks.has(downloadId) ||
      this.suppressedIds.has(downloadId) ||
      this.workers.has(downloadId) ||
      this.ensureScheduler().has(downloadId)
    ) {
      return;
    }

    // Offline / Wi-Fi waiting — do not promote FAILED→QUEUED (avoids retry storms).
    const settings = getDownloadSettings();
    const network = getDownloadNetworkState();
    const admission = evaluateNetworkAdmission(settings.wifiOnly, network);
    if (!admission.allowed) {
      hardeningLog('retry.scheduled', {
        downloadId,
        deferred: true,
        reason: admission.reason,
      });
      // Keep FAILED + RETRY_WAIT; reschedule without resetting retryCount.
      this.scheduleAutoRetry(downloadId, computeRetryDelayMs(0));
      return;
    }

    this.locks.add(downloadId);
    try {
      const existing = await getLocalRecord(downloadId);
      if (
        !existing ||
        existing.remoteStatus !== 'FAILED' ||
        !shouldScheduleAutoRetry({
          retryEligible: existing.retryEligible,
          retryCount: existing.retryCount,
          errorCode: existing.errorCode,
        })
      ) {
        return;
      }

      const prepared = await this.prepareRetryPartial(existing);
      const nextCount = prepared.retryCount + 1;

      this.setStatusHint(downloadId, 'QUEUED');
      const enqueued = this.ensureScheduler().enqueue({
        id: prepared.downloadId,
        sourceUrl: prepared.sourceUrl,
        fileName: prepared.fileName,
        fileSize: prepared.expectedFileSize,
      });
      if (!enqueued) {
        return;
      }

      await upsertLocalRecord({
        ...prepared,
        localState: 'not_started',
        remoteStatus: 'QUEUED',
        errorCode: null,
        errorMessage: null,
        retryCount: nextCount,
        nextRetryAt: null,
        lastAttemptAt: new Date().toISOString(),
      });

      try {
        await syncStatusImmediate(downloadId, 'QUEUED', {
          errorCode: null,
          errorMessage: null,
        });
      } catch {
        // ignore
      }
      this.emit({ type: 'status', downloadId, status: 'QUEUED' });
    } finally {
      this.locks.delete(downloadId);
    }

    this.pump();
  }

  /**
   * Validate partial for Range reuse; wipe and clear pauseState when unsafe.
   */
  private async prepareRetryPartial(
    existing: LocalDownloadRecord,
  ): Promise<LocalDownloadRecord> {
    if (isPlaylistOrStreamUrl(existing.sourceUrl)) {
      return {
        ...existing,
        pauseState: null,
        rangeValidators: null,
      };
    }

    const destination = resolveDestinationFile(
      existing.downloadId,
      existing.fileName,
    );
    deleteRangePartQuiet(destination);

    const forceCleanRestart =
      existing.errorCode === 'SOURCE_CHANGED' ||
      existing.errorCode === 'RESUME_UNSUPPORTED' ||
      existing.errorCode === 'RANGE_REJECTED' ||
      existing.errorCode === 'INVALID_RANGE_RESPONSE' ||
      existing.errorCode === 'PARTIAL_FILE_CORRUPT' ||
      existing.errorCode === 'FINAL_FILE_INVALID' ||
      existing.errorCode === 'PARTIAL_FILE_MISSING' ||
      existing.errorCode === 'RESUME_STATE_MISSING' ||
      existing.errorCode === 'MERGE_FAILED' ||
      existing.errorCode === 'PART_SIZE_MISMATCH' ||
      existing.errorCode === 'FINAL_SIZE_MISMATCH';

    if (forceCleanRestart) {
      try {
        await cleanupMultiRangeWorkspace(existing.downloadId);
        await deleteDownloadFiles(existing.downloadId);
      } catch {
        // ignore
      }
      return {
        ...existing,
        pauseState: null,
        multiRange: null,
        rangeValidators: null,
        bytesWritten: 0,
        localUri: null,
      };
    }

    if (hasResumableMultiRange(existing.multiRange)) {
      return {
        ...existing,
        pauseState: null,
        multiRange: existing.multiRange,
        rangeValidators: existing.rangeValidators ?? null,
        bytesWritten: sumMultiRangeDownloaded(existing.multiRange!),
        localUri: existing.localUri,
      };
    }

    if (!existing.pauseState?.resumeData) {
      // Controlled restart from byte 0 — remove any stray partial.
      try {
        if (destination.exists) {
          destination.delete();
        }
        await cleanupMultiRangeWorkspace(existing.downloadId);
      } catch {
        // ignore
      }
      return {
        ...existing,
        pauseState: null,
        multiRange: null,
        rangeValidators: existing.rangeValidators,
        bytesWritten: 0,
        localUri: null,
      };
    }

    const verified = verifyPartialForRetry(
      destination,
      existing.pauseState.fileUri ?? existing.localUri,
    );
    if (!verified.ok) {
      try {
        await deleteDownloadFiles(existing.downloadId);
      } catch {
        // ignore
      }
      return {
        ...existing,
        pauseState: null,
        multiRange: null,
        rangeValidators: null,
        bytesWritten: 0,
        localUri: null,
      };
    }

    const durable = buildDurablePauseState(
      existing.sourceUrl,
      destination,
      existing.pauseState,
      verified.size,
    );
    if (!durable) {
      try {
        await deleteDownloadFiles(existing.downloadId);
      } catch {
        // ignore
      }
      return {
        ...existing,
        pauseState: null,
        multiRange: null,
        bytesWritten: 0,
        localUri: null,
      };
    }

    const offset = parseAndroidResumeOffset(durable.resumeData);
    return {
      ...existing,
      pauseState: durable,
      multiRange: null,
      bytesWritten: offset ?? verified.size,
      localUri: destination.uri,
    };
  }

  private pump(): void {
    this.ensureScheduler().requestDrain();
  }

  /**
   * Admission handoff — register worker ownership and kick off transfer without
   * awaiting completion (so the serialized drain can continue).
   * Ensures Android FGS protection via DownloadExecutionCoordinator (Model B).
   */
  private async admitWorker(job: SchedulerJobInput): Promise<boolean> {
    const input: EnqueueInput = {
      id: job.id,
      sourceUrl: job.sourceUrl,
      fileName: job.fileName,
      fileSize: job.fileSize,
      title: job.title,
    };

    if (
      this.locks.has(input.id) ||
      this.suppressedIds.has(input.id) ||
      this.workers.has(input.id)
    ) {
      return false;
    }

    // Duplicate defense: coordinator already tracks this execution.
    const coordinator = getDownloadExecutionCoordinator();
    if (coordinator.isExecutionOwned(input.id) && this.workers.has(input.id)) {
      return false;
    }

    const existing = await getLocalRecord(input.id);

    if (
      this.suppressedIds.has(input.id) ||
      this.locks.has(input.id) ||
      !existing ||
      TERMINAL_LOCAL.has(existing.localState) ||
      existing.remoteStatus === 'CANCELLED' ||
      existing.remoteStatus === 'COMPLETED' ||
      existing.remoteStatus === 'FAILED' ||
      existing.remoteStatus === 'PAUSED'
    ) {
      if (existing?.remoteStatus) {
        this.setStatusHint(input.id, existing.remoteStatus);
      }
      return false;
    }

    // Provisional FGS ownership BEFORE worker registration (stop-race safe).
    const begin = await coordinator.beginExecution(input.id);
    if (!begin.admitted) {
      await coordinator.endExecution(input.id);
      return false;
    }

    if (this.suppressedIds.has(input.id) || this.workers.has(input.id)) {
      await coordinator.endExecution(input.id);
      return false;
    }

    const worker: AnyTransferWorker = isPlaylistOrStreamUrl(input.sourceUrl)
      ? new HlsTransferWorker(
          (event) => this.emit(event),
          (snapshot) => this.publishSnapshot(snapshot),
        )
      : new TransferWorker(
          (event) => this.emit(event),
          (snapshot) => this.publishSnapshot(snapshot),
          () => [...this.workers.keys()],
        );

    this.workers.set(input.id, worker);
    this.setStatusHint(input.id, 'DOWNLOADING');

    void (async () => {
      try {
        if (this.suppressedIds.has(input.id)) {
          await worker.cancel(input.id);
          return;
        }
        await worker.run(input, existing);
      } finally {
        this.workers.delete(input.id);
        this.ensureScheduler().release(input.id);
        try {
          await coordinator.endExecution(input.id);
        } catch {
          // never block settle
        }
        void this.afterWorkerSettled(input.id);
      }
    })();

    return true;
  }

  /**
   * Slot is already free — schedule auto-retry outside the concurrency budget,
   * then reevaluate so unrelated queued jobs are not starved during backoff.
   */
  private async afterWorkerSettled(downloadId: string): Promise<void> {
    try {
      if (!this.suppressedIds.has(downloadId)) {
        const record = await getLocalRecord(downloadId);
        if (
          record &&
          record.remoteStatus === 'FAILED' &&
          shouldScheduleAutoRetry({
            retryEligible: record.retryEligible,
            retryCount: record.retryCount,
            errorCode: record.errorCode,
          })
        ) {
          this.setStatusHint(downloadId, 'FAILED');
          this.scheduleAutoRetry(downloadId);
        } else if (
          record &&
          record.remoteStatus === 'FAILED' &&
          record.retryEligible &&
          record.retryCount >= DOWNLOAD_ENGINE.maxAutoRetryAttempts &&
          record.errorCode &&
          isAutoRetryableCode(record.errorCode) &&
          record.errorCode !== 'RETRY_EXHAUSTED'
        ) {
          // Budget exhausted — stamp explicit terminal reason without wiping progress.
          const message = toUserFacingErrorMessage(
            'RETRY_EXHAUSTED',
            record.errorMessage ?? undefined,
          );
          await upsertLocalRecord({
            ...record,
            errorCode: 'RETRY_EXHAUSTED',
            errorMessage: message,
            nextRetryAt: null,
            retryEligible: true,
          });
          try {
            await syncStatusImmediate(downloadId, 'FAILED', {
              errorCode: 'RETRY_EXHAUSTED',
              errorMessage: message,
            });
          } catch {
            // ignore
          }
          this.setStatusHint(downloadId, 'FAILED');
          this.emit({
            type: 'failed',
            downloadId,
            code: 'RETRY_EXHAUSTED',
            message,
          });
        } else if (record?.remoteStatus) {
          // Never regress an intentional resume/retry that already advanced
          // past this settle. Pause settle is async: afterWorkerSettled may
          // still see PAUSED after resume() already set QUEUED — that stale
          // hint makes enqueue() reject with RESUME_FAILED.
          const currentHint = this.statusHints.get(downloadId);
          const stalePauseOverAdvanced =
            record.remoteStatus === 'PAUSED' &&
            (currentHint === 'QUEUED' ||
              currentHint === 'DOWNLOADING' ||
              currentHint === 'COMPLETED' ||
              currentHint === 'CANCELLED');
          if (!stalePauseOverAdvanced) {
            this.setStatusHint(downloadId, record.remoteStatus);
          }
        }
      }
    } catch {
      // never block drain
    }
    this.pump();
  }

  private publishSnapshot(snapshot: TransferProgressSnapshot): void {
    if (this.suppressedIds.has(snapshot.downloadId)) {
      return;
    }
    const previous = this.snapshots.get(snapshot.downloadId);
    // Live progress must not regress from stale native callbacks.
    const progress =
      previous &&
      snapshot.localState === 'transferring' &&
      previous.localState === 'transferring'
        ? Math.max(previous.progress, snapshot.progress)
        : snapshot.progress;

    const next: TransferProgressSnapshot = {
      ...snapshot,
      progress: Math.max(0, Math.min(100, progress)),
      bytesWritten: Math.max(0, snapshot.bytesWritten),
    };
    this.snapshots.set(snapshot.downloadId, next);
    for (const listener of this.progressListeners) {
      try {
        listener(next);
      } catch {
        // never throw into engine
      }
    }
  }

  private emit(event: EngineEvent): void {
    if (
      'downloadId' in event &&
      this.suppressedIds.has(event.downloadId) &&
      event.type !== 'cancelled' &&
      event.type !== 'status'
    ) {
      // Allow cancelled/status terminal emits from cancel(); drop completed/failed/progress.
      if (event.type === 'completed' || event.type === 'failed') {
        return;
      }
    }
    if (
      event.type === 'completed' &&
      this.suppressedIds.has(event.downloadId)
    ) {
      return;
    }
    if (
      event.type === 'status' &&
      this.suppressedIds.has(event.downloadId) &&
      event.status !== 'CANCELLED'
    ) {
      return;
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // never throw into engine
      }
    }
  }
}

export const downloadEngine = new DownloadEngine();

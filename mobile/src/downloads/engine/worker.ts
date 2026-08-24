import { DownloadTask, File, type DownloadPauseState } from 'expo-file-system';
import { Platform } from 'react-native';

import { resumeAppendRangeTransfer } from './append-range-transfer';
import {
  assertEnoughDiskSpace,
  assertEnoughDiskSpaceForTransfer,
  assertValidDestination,
  deleteDownloadFiles,
  deleteRangePartQuiet,
  resolveDestinationFile,
  verifyCompletedFile,
} from './file-paths';
import {
  classifyTransferError,
  classifyTransferFailure,
  DownloadEngineError,
  toUserFacingErrorMessage,
} from './errors';
import { DOWNLOAD_ENGINE } from './constants';
import {
  assertDurablePauseReady,
  buildDurablePauseState,
  mergeRangeValidators,
  parseAndroidResumeOffset,
  readPartialFileSize,
} from './pause-state';
import { upsertLocalRecord } from './persistence';
import {
  createProgressTracker,
  computeProgressPercent,
  normalizeTotalBytes,
  toTransferSnapshot,
} from './progress';
import { isManualRetryAllowed } from './retry-policy';
import {
  isPlaylistOrStreamUrl,
  isSafeHttpUrl,
  sanitizeFileName,
} from './resource-guard';
import {
  assertSourceIdentityCompatible,
  probeSourceIdentity,
} from './source-identity';
import {
  cleanupMultiRangeWorkspace,
  getGlobalNetworkBudget,
  hasResumableMultiRange,
  runMultiRangeTransfer,
  sumMultiRangeDownloaded,
} from './multi-range';
import {
  clearSyncState,
  syncProgressThrottled,
  syncStatusImmediate,
} from './synchronizer';
import type {
  EnqueueInput,
  EngineEvent,
  LocalDownloadRecord,
  MultiRangeTransferState,
  RangeValidators,
  TransferProgressSnapshot,
} from './types';

type Emit = (event: EngineEvent) => void;
type OnProgress = (snapshot: TransferProgressSnapshot) => void;
type GetActiveDownloadIds = () => string[];

type ActiveWorker = {
  downloadId: string;
  generation: number;
  task: DownloadTask | null;
  abortController: AbortController;
  running: boolean;
  /** Set by cancel() — beats late progress/completion callbacks. */
  cancelled: boolean;
  /** Set by pause() — run() must prefer PAUSED over FAILED if settle is noisy. */
  pauseRequested: boolean;
  /** Cumulative floor after resume — detect silent restart-from-0. */
  resumeByteFloor: number;
};

/**
 * Owns a single progressive HTTP(S) transfer lifecycle.
 * Completion requires file verification — network success alone is not enough.
 * Multi-range acceleration is delegated inside run() when eligible; otherwise
 * the existing single-stream / Phase 2 append-range path is used.
 */
export class TransferWorker {
  private active: ActiveWorker | null = null;

  constructor(
    private readonly emit: Emit,
    private readonly onProgress: OnProgress,
    private readonly getActiveDownloadIds: GetActiveDownloadIds = () => [],
  ) {}

  get activeDownloadId(): string | null {
    return this.active?.downloadId ?? null;
  }

  isActive(downloadId: string): boolean {
    return this.active?.downloadId === downloadId && Boolean(this.active?.running);
  }

  private isCurrentGeneration(generation: number): boolean {
    return (
      this.active != null &&
      this.active.generation === generation &&
      !this.active.cancelled
    );
  }

  /** Progress ownership after pause is requested — blocks DOWNLOADING resurrection. */
  private canPublishTransferProgress(generation: number): boolean {
    return (
      this.isCurrentGeneration(generation) &&
      !this.active?.pauseRequested
    );
  }

  async run(
    input: EnqueueInput,
    existing: LocalDownloadRecord | null,
  ): Promise<void> {
    if (this.active?.running) {
      throw new DownloadEngineError(
        'UNKNOWN_ERROR',
        'Transfer worker is already busy.',
      );
    }

    if (!isSafeHttpUrl(input.sourceUrl)) {
      await this.fail(input, existing, 'INVALID_RESOURCE', 'Invalid download URL.');
      return;
    }

    // Progressive worker refuses playlists — manager routes those to HlsTransferWorker.
    if (isPlaylistOrStreamUrl(input.sourceUrl)) {
      await this.fail(
        input,
        existing,
        'HLS_UNSUPPORTED',
        toUserFacingErrorMessage('HLS_UNSUPPORTED'),
      );
      return;
    }

    const expectedBytes = Number(input.fileSize);

    const generation = (existing?.generation ?? 0) + 1;
    const destination = resolveDestinationFile(input.id, input.fileName, {
      sourceUrl: input.sourceUrl,
    });
    assertValidDestination(destination);

    const existingPartial = readPartialFileSize(destination);
    assertEnoughDiskSpaceForTransfer({
      expectedTotalBytes:
        Number.isFinite(expectedBytes) && expectedBytes > 0
          ? expectedBytes
          : existing?.totalBytes ?? null,
      partialBytes: existingPartial,
    });
    if (
      (!Number.isFinite(expectedBytes) || expectedBytes <= 0) &&
      existingPartial <= 0
    ) {
      assertEnoughDiskSpace(0);
    }

    const abortController = new AbortController();
    const tracker = createProgressTracker();

    let pauseState: DownloadPauseState | null = existing?.pauseState ?? null;
    let rangeValidators: RangeValidators | null =
      existing?.rangeValidators ?? null;
    let multiRangeState: MultiRangeTransferState | null =
      existing?.multiRange ?? null;
    let bytesWritten = existing?.bytesWritten ?? 0;
    let totalBytes = normalizeTotalBytes(existing?.totalBytes);
    let task: DownloadTask | null = null;
    let retryCount = existing?.retryCount ?? 0;
    const maxRetries =
      existing?.maxRetries ?? DOWNLOAD_ENGINE.maxAutoRetryAttempts;

    const recordBase = async (
      localState: LocalDownloadRecord['localState'],
      extras?: Partial<LocalDownloadRecord>,
    ) => {
      const record: LocalDownloadRecord = {
        downloadId: input.id,
        sourceUrl: input.sourceUrl,
        fileName: sanitizeFileName(input.fileName),
        expectedFileSize: input.fileSize,
        localUri: destination.uri,
        localState,
        bytesWritten,
        totalBytes,
        pauseState,
        rangeValidators,
        multiRange: multiRangeState,
        generation,
        errorCode: extras?.errorCode ?? null,
        errorMessage: extras?.errorMessage ?? null,
        remoteStatus: extras?.remoteStatus ?? null,
        retryCount,
        maxRetries,
        retryEligible: extras?.retryEligible ?? existing?.retryEligible ?? true,
        lastAttemptAt: extras?.lastAttemptAt ?? existing?.lastAttemptAt ?? null,
        nextRetryAt: extras?.nextRetryAt ?? null,
        updatedAt: new Date().toISOString(),
        ...extras,
      };
      await upsertLocalRecord(record);
      return record;
    };

    const publishProgress = (
      forceUi = false,
      localState: TransferProgressSnapshot['localState'] = 'transferring',
    ) => {
      if (localState === 'transferring') {
        if (!this.canPublishTransferProgress(generation) && !forceUi) {
          return null;
        }
      } else if (!this.isCurrentGeneration(generation) && !forceUi) {
        return null;
      }

      const noted = tracker.note(bytesWritten, totalBytes);
      const snapshot = toTransferSnapshot(
        input.id,
        {
          bytesWritten: noted.bytesWritten,
          totalBytes: noted.totalBytes,
          // Never publish a synthetic 0% over known cumulative bytes.
          progress:
            noted.progress === 0 && bytesWritten > 0
              ? Math.max(
                  noted.progress,
                  computeProgressPercent(
                    bytesWritten,
                    normalizeTotalBytes(totalBytes) ??
                      normalizeTotalBytes(Number(input.fileSize)),
                  ),
                )
              : noted.progress,
          bytesPerSecond: noted.bytesPerSecond,
          etaSeconds: noted.etaSeconds,
        },
        destination.uri,
        localState,
      );

      const knownTotal = normalizeTotalBytes(totalBytes);
      const shouldUpdateUi =
        forceUi || !('shouldUpdateUi' in noted) || noted.shouldUpdateUi;
      const shouldUpdateBackend =
        !forceUi &&
        'shouldUpdateBackend' in noted &&
        noted.shouldUpdateBackend &&
        knownTotal != null &&
        snapshot.progress > 0;

      if (shouldUpdateUi) {
        this.onProgress(snapshot);
      }

      if (shouldUpdateBackend && knownTotal != null) {
        syncProgressThrottled(input.id, snapshot.progress, String(knownTotal));
      }

      return snapshot;
    };

    this.active = {
      downloadId: input.id,
      generation,
      task: null,
      abortController,
      running: true,
      cancelled: false,
      pauseRequested: false,
      resumeByteFloor: 0,
    };

    const capturePauseState = (
      taskRef: DownloadTask | null,
    ): DownloadPauseState | null => {
      let fromTask: DownloadPauseState | null = null;
      try {
        if (taskRef?.state === 'paused') {
          fromTask = taskRef.savable();
        }
      } catch {
        fromTask = null;
      }
      return buildDurablePauseState(
        input.sourceUrl,
        destination,
        fromTask ?? pauseState,
        bytesWritten,
      );
    };

    const settlePaused = async (nextPause: DownloadPauseState | null) => {
      const durable = nextPause
        ? buildDurablePauseState(
            input.sourceUrl,
            destination,
            nextPause,
            bytesWritten,
          )
        : capturePauseState(task);

      // Never declare a clean PAUSED without durable resume state + matching partial.
      if (!durable) {
        throw new DownloadEngineError(
          'PAUSE_FAILED',
          'Couldn’t pause this download right now. Try again in a moment.',
        );
      }

      assertDurablePauseReady(destination, durable, {
        // iOS opaque resume may have empty destination while resumeData is valid.
        requireBytes: parseAndroidResumeOffset(durable.resumeData) != null,
      });

      pauseState = durable;
      const offset = parseAndroidResumeOffset(durable.resumeData);
      if (offset != null) {
        bytesWritten = Math.max(bytesWritten, offset);
      } else {
        bytesWritten = Math.max(bytesWritten, readPartialFileSize(destination));
      }

      await recordBase('paused', {
        pauseState: durable,
        rangeValidators,
        multiRange: multiRangeState,
        remoteStatus: 'PAUSED',
        errorCode: null,
        errorMessage: null,
      });
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      // Status before paused progress so the store bridge does not drop the snapshot
      // while still showing DOWNLOADING.
      this.emit({ type: 'status', downloadId: input.id, status: 'PAUSED' });
      publishProgress(true, 'paused');
      // Status-only PAUSED sync — do not bundle regressing progress.
      await syncStatusImmediate(input.id, 'PAUSED');
    };

    const settleMultiRangePaused = async (state: MultiRangeTransferState) => {
      multiRangeState = state;
      rangeValidators = mergeRangeValidators(
        rangeValidators,
        state.sourceValidators,
      );
      bytesWritten = sumMultiRangeDownloaded(state);
      totalBytes = state.contentLength;
      // Multi-range pause uses part checkpoints — not DownloadTask resumeData.
      pauseState = null;

      await recordBase('paused', {
        pauseState: null,
        multiRange: state,
        rangeValidators,
        remoteStatus: 'PAUSED',
        errorCode: null,
        errorMessage: null,
      });
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      this.emit({ type: 'status', downloadId: input.id, status: 'PAUSED' });
      publishProgress(true, 'paused');
      await syncStatusImmediate(input.id, 'PAUSED');
    };

    let resumeRestartDetected = false;

    try {
      await recordBase('transferring', { remoteStatus: 'DOWNLOADING' });
      if (!this.isCurrentGeneration(generation)) {
        return;
      }

      // Best-effort source identity capture / revalidation before bytes move.
      try {
        const probe = await probeSourceIdentity(
          input.sourceUrl,
          abortController.signal,
        );
        if (probe.validators) {
          if (
            pauseState?.resumeData ||
            existingPartial > 0 ||
            hasResumableMultiRange(multiRangeState)
          ) {
            assertSourceIdentityCompatible(rangeValidators, probe.validators);
          }
          rangeValidators = mergeRangeValidators(
            rangeValidators,
            probe.validators,
          );
          if (
            probe.validators.contentLength != null &&
            probe.validators.contentLength > 0
          ) {
            totalBytes =
              normalizeTotalBytes(totalBytes) ??
              normalizeTotalBytes(probe.validators.contentLength);
          }
        }
      } catch (probeError) {
        if (
          probeError instanceof DownloadEngineError &&
          (probeError.code === 'SOURCE_CHANGED' ||
            probeError.code === 'AUTH_ERROR' ||
            probeError.code === 'INVALID_RESOURCE' ||
            probeError.code === 'CANCELLED')
        ) {
          throw probeError;
        }
        // Soft failure — continue without validators.
      }

      let transferPromise: Promise<File | null>;

      const handleNativeProgress = (data: {
        bytesWritten: number;
        totalBytes: number;
      }) => {
        if (!this.canPublishTransferProgress(generation)) {
          return;
        }

        const floor = this.active?.resumeByteFloor ?? 0;
        const nextBytes = Math.max(0, data.bytesWritten);

        // Expo Android rewrites from byte 0 when Range is ignored (HTTP 200).
        // Abort instead of corrupting the partial / presenting a fake fresh start.
        if (floor > 0 && nextBytes + 1024 < floor) {
          resumeRestartDetected = true;
          try {
            abortController.abort();
          } catch {
            // ignore
          }
          try {
            task?.cancel();
          } catch {
            // ignore
          }
          return;
        }

        bytesWritten = Math.max(floor, nextBytes);
        const nextTotal = normalizeTotalBytes(data.totalBytes);
        if (nextTotal != null) {
          totalBytes =
            totalBytes != null ? Math.max(nextTotal, totalBytes) : nextTotal;
        }
        publishProgress(false, 'transferring');
      };

      // Multi-range acceleration (Android progressive only). Never convert an
      // in-flight single-stream Phase 2 resume (pauseState.resumeData).
      const preferSingleStreamResume = Boolean(pauseState?.resumeData);
      const tryMultiRange =
        Platform.OS === 'android' &&
        !preferSingleStreamResume &&
        (hasResumableMultiRange(multiRangeState) || existingPartial <= 0);

      if (tryMultiRange) {
        this.active.task = null;
        this.emit({
          type: 'status',
          downloadId: input.id,
          status: 'DOWNLOADING',
        });
        if (hasResumableMultiRange(multiRangeState)) {
          bytesWritten = Math.max(
            bytesWritten,
            sumMultiRangeDownloaded(multiRangeState!),
          );
          totalBytes =
            normalizeTotalBytes(totalBytes) ??
            multiRangeState!.contentLength;
          this.active.resumeByteFloor = bytesWritten;
          tracker.seed(bytesWritten);
        }
        publishProgress(true, 'transferring');

        const multiResult = await runMultiRangeTransfer({
          downloadId: input.id,
          sourceUrl: input.sourceUrl,
          destination,
          knownFileSize:
            Number.isFinite(expectedBytes) && expectedBytes > 0
              ? expectedBytes
              : totalBytes,
          platformOs: Platform.OS,
          priorValidators: rangeValidators,
          priorState: multiRangeState,
          activeDownloadIds: this.getActiveDownloadIds(),
          signal: abortController.signal,
          shouldPause: () => Boolean(this.active?.pauseRequested),
          onProgress: (event) => {
            if (!this.canPublishTransferProgress(generation)) {
              return;
            }
            bytesWritten = event.bytesWritten;
            totalBytes = event.totalBytes;
            publishProgress(false, 'transferring');
          },
          onCheckpoint: (state, force) => {
            multiRangeState = state;
            rangeValidators = mergeRangeValidators(
              rangeValidators,
              state.sourceValidators,
            );
            bytesWritten = sumMultiRangeDownloaded(state);
            totalBytes = state.contentLength;
            if (force) {
              void recordBase('transferring', {
                remoteStatus: 'DOWNLOADING',
                multiRange: state,
              });
            }
          },
        });

        if (!this.isCurrentGeneration(generation)) {
          return;
        }

        if (multiResult.status === 'completed') {
          multiRangeState = null;
          await this.complete(
            input,
            destination,
            multiResult.file,
            multiResult.state.contentLength,
            generation,
          );
          return;
        }

        if (multiResult.status === 'paused') {
          await settleMultiRangePaused(multiResult.state);
          return;
        }

        // Ineligible → existing single-stream. Never mix with an active multi-range checkpoint.
        if (hasResumableMultiRange(multiRangeState)) {
          throw new DownloadEngineError(
            'TRANSFER_INTERRUPTED',
            'Unable to continue this multi-range download.',
          );
        }
        await cleanupMultiRangeWorkspace(input.id);
        multiRangeState = null;
      }

      if (pauseState?.resumeData) {
        const durable = buildDurablePauseState(
          input.sourceUrl,
          destination,
          pauseState,
          bytesWritten,
        );
        if (!durable?.resumeData) {
          throw new DownloadEngineError(
            'RESUME_STATE_MISSING',
            'Unable to resume this download.',
          );
        }

        const androidOffset = parseAndroidResumeOffset(durable.resumeData);
        const partialSize = readPartialFileSize(destination);
        // Android numeric resume needs on-disk bytes. iOS opaque resumeData can
        // resume from a temp file even when the destination size is still 0.
        if (partialSize <= 0 && androidOffset != null) {
          throw new DownloadEngineError(
            'PARTIAL_FILE_MISSING',
            'The partial download file is no longer available.',
          );
        }
        if (partialSize <= 0 && !durable.resumeData) {
          throw new DownloadEngineError(
            'PARTIAL_FILE_MISSING',
            'The partial download file is no longer available.',
          );
        }

        pauseState = {
          ...durable,
          resumeData:
            androidOffset != null ? String(partialSize) : durable.resumeData,
          fileUri: destination.uri,
          isDirectory: false,
        };
        bytesWritten = Math.max(bytesWritten, partialSize);
        totalBytes =
          normalizeTotalBytes(totalBytes) ??
          normalizeTotalBytes(Number(input.fileSize));
        this.active.resumeByteFloor = partialSize;
        tracker.seed(partialSize);

        // Advertise DOWNLOADING before seeding progress so the store bridge does
        // not drop the cumulative snapshot while status is still PAUSED.
        this.emit({ type: 'status', downloadId: input.id, status: 'DOWNLOADING' });
        publishProgress(true, 'transferring');

        // Android: HTTP Range append only. Never Expo resumeAsync (truncates on
        // HTTP 200) and never a fresh downloadAsync (deletes the partial).
        const useAppendRangeResume = Platform.OS === 'android' && partialSize > 0;

        if (useAppendRangeResume) {
          this.active.task = null;
          transferPromise = resumeAppendRangeTransfer({
            sourceUrl: input.sourceUrl,
            destination,
            offset: partialSize,
            signal: abortController.signal,
            headers: pauseState.headers ?? null,
            validators: rangeValidators,
            knownTotalBytes: totalBytes,
            shouldPause: () => Boolean(this.active?.pauseRequested),
            onProgress: (data) => {
              handleNativeProgress({
                bytesWritten: data.bytesWritten,
                totalBytes: data.totalBytes,
              });
            },
            onValidators: (next) => {
              rangeValidators = mergeRangeValidators(rangeValidators, next);
            },
          });
        } else {
          task = DownloadTask.fromSavable(pauseState, {
            signal: abortController.signal,
            onProgress: handleNativeProgress,
            sessionType: 'background',
          });
          this.active.task = task;
          transferPromise = task.resumeAsync();
        }
      } else {
        // Fresh transfer — remove any partial destination first.
        try {
          if (destination.exists) {
            destination.delete();
          }
        } catch {
          // continue; createDownloadTask may overwrite depending on platform
        }

        if (!this.isCurrentGeneration(generation)) {
          return;
        }

        this.active.resumeByteFloor = 0;
        task = File.createDownloadTask(input.sourceUrl, destination, {
          signal: abortController.signal,
          onProgress: handleNativeProgress,
          sessionType: 'background',
        });
        this.active.task = task;
        transferPromise = task.downloadAsync();

        this.emit({ type: 'status', downloadId: input.id, status: 'DOWNLOADING' });
      }

      // Status-only sync: bundling progress:0 races with live progress and 409s.
      await syncStatusImmediate(input.id, 'DOWNLOADING');

      if (!this.isCurrentGeneration(generation)) {
        return;
      }

      let file: File | null;
      try {
        file = await transferPromise;
      } catch (transferError) {
        if (resumeRestartDetected) {
          throw new DownloadEngineError(
            'RESUME_UNSUPPORTED',
            'This server doesn’t support resumable downloads.',
          );
        }
        if (this.active.pauseRequested) {
          throw transferError;
        }
        const floor = this.active.resumeByteFloor;
        if (floor > 0 && readPartialFileSize(destination) + 1024 < floor) {
          throw new DownloadEngineError(
            'RESUME_UNSUPPORTED',
            'This server doesn’t support resumable downloads.',
          );
        }
        throw transferError;
      }

      if (!this.isCurrentGeneration(generation)) {
        return;
      }

      if (file === null) {
        await settlePaused(capturePauseState(task));
        return;
      }

      await this.complete(input, destination, file, totalBytes, generation);
    } catch (error) {
      if (!this.active || this.active.generation !== generation) {
        return;
      }

      // pause() may abort the fetch to unblock reads — prefer PAUSED over cancel.
      if (this.active.pauseRequested && !this.active.cancelled) {
        try {
          if (hasResumableMultiRange(multiRangeState)) {
            await settleMultiRangePaused(multiRangeState!);
            return;
          }
          const nextPause = capturePauseState(task);
          await settlePaused(nextPause);
          return;
        } catch (pauseError) {
          // Do not fake PAUSED and do not delete the partial via fail().
          // Manager detects missing resumeData and surfaces PAUSE_FAILED.
          const code =
            pauseError instanceof DownloadEngineError &&
            (pauseError.code === 'PAUSE_FAILED' ||
              pauseError.code === 'PARTIAL_FILE_MISSING')
              ? pauseError.code
              : 'PAUSE_FAILED';
          const message = toUserFacingErrorMessage(
            code,
            pauseError instanceof Error ? pauseError.message : undefined,
          );
          try {
            await recordBase('transferring', {
              remoteStatus: 'DOWNLOADING',
              errorCode: code,
              errorMessage: message,
            });
          } catch {
            // ignore persistence failure
          }
          return;
        }
      }

      // External cancel() owns terminal CANCELLED sync/emit/cleanup.
      if (this.active.cancelled || abortController.signal.aborted) {
        if (resumeRestartDetected) {
          const classifiedRestart = new DownloadEngineError(
            'RESUME_UNSUPPORTED',
            'This server doesn’t support resumable downloads.',
          );
          await this.fail(
            input,
            existing,
            classifiedRestart.code,
            classifiedRestart.message,
            generation,
            {
              destination,
              bytesWritten: Math.max(bytesWritten, this.active.resumeByteFloor),
              totalBytes,
              pauseState,
              rangeValidators,
              wipePartial: true,
            },
          );
          return;
        }
        this.active.running = false;
        return;
      }

      const classified = classifyTransferFailure(error).error;
      if (classified.code === 'CANCELLED') {
        this.active.running = false;
        return;
      }

      // Resume outcomes:
      // - Retryable network → FAILED with partial preserved (auto-retry).
      // - SOURCE_CHANGED / invalid range / resume unsupported → FAILED + wipe.
      // - Other resume failures → FAILED; preserve only when disk partial is safe.
      const wasResuming =
        this.active.resumeByteFloor > 0 ||
        existing?.localState === 'paused' ||
        existing?.remoteStatus === 'PAUSED' ||
        Boolean(existing?.pauseState?.resumeData) ||
        hasResumableMultiRange(multiRangeState) ||
        hasResumableMultiRange(existing?.multiRange);

      if (wasResuming) {
        const wipeCodes = new Set([
          'SOURCE_CHANGED',
          'RESUME_UNSUPPORTED',
          'RANGE_REJECTED',
          'INVALID_RANGE_RESPONSE',
          'PARTIAL_FILE_MISSING',
          'RESUME_STATE_MISSING',
          'PARTIAL_FILE_CORRUPT',
          'MERGE_FAILED',
          'PART_SIZE_MISMATCH',
          'FINAL_SIZE_MISMATCH',
          'AUTH_ERROR',
          'INVALID_RESOURCE',
        ]);
        const shouldWipe = wipeCodes.has(classified.code);
        await this.fail(
          input,
          existing,
          classified.code,
          classified.message,
          generation,
          {
            destination,
            bytesWritten,
            totalBytes,
            pauseState,
            rangeValidators,
            multiRange: multiRangeState,
            wipePartial: shouldWipe,
          },
        );
        return;
      }

      await this.fail(
        input,
        existing,
        classified.code,
        classified.message,
        generation,
        {
          destination,
          bytesWritten,
          totalBytes,
          pauseState,
          rangeValidators,
          multiRange: multiRangeState,
        },
      );
    } finally {
      if (this.active?.generation === generation) {
        try {
          this.active.task?.release();
        } catch {
          // ignore
        }
        this.active.running = false;
        // Keep cancelled flag visible until manager clears the worker map entry.
        if (!this.active.cancelled) {
          this.active = null;
        }
      }
    }
  }

  async pause(downloadId: string): Promise<boolean> {
    if (!this.active || this.active.downloadId !== downloadId) {
      return false;
    }
    if (this.active.cancelled || !this.active.running) {
      return false;
    }

    const task = this.active.task;

    // Append-range resume has no DownloadTask — pause via flag (+ abort to unblock).
    if (!task) {
      this.active.pauseRequested = true;
      try {
        this.active.abortController.abort();
      } catch {
        // ignore
      }
      return true;
    }

    if (task.state === 'paused') {
      this.active.pauseRequested = true;
      return true;
    }
    if (task.state !== 'active') {
      return false;
    }

    try {
      // Request native pause only. Do NOT await pauseAsync()/_inFlightOperation:
      // on Android the cancelled OkHttp call can reject the download promise even
      // after resumeData is captured, which previously surfaced as "Couldn't pause"
      // while Cancel (abort path) still worked. run() persists PAUSED when the
      // transfer settles null (or via pauseRequested recovery).
      this.active.pauseRequested = true;
      task.pause();
      return true;
    } catch (error) {
      this.active.pauseRequested = false;
      throw classifyTransferError(error);
    }
  }

  /**
   * Abort the in-flight native transfer. Manager owns CANCELLED persistence.
   * Sets cancelled so a late completion callback cannot resurrect the job.
   */
  async cancel(downloadId: string): Promise<boolean> {
    if (!this.active || this.active.downloadId !== downloadId) {
      return false;
    }
    this.active.cancelled = true;
    this.active.running = false;
    try {
      this.active.abortController.abort();
      this.active.task?.cancel();
      getGlobalNetworkBudget().releaseAll(downloadId);
      await cleanupMultiRangeWorkspace(downloadId);
      return true;
    } catch {
      getGlobalNetworkBudget().releaseAll(downloadId);
      return true;
    }
  }

  private async complete(
    input: EnqueueInput,
    destination: File,
    file: File,
    totalBytes: number | null,
    generation: number,
  ): Promise<void> {
    // Cancellation must beat late completion.
    if (!this.isCurrentGeneration(generation)) {
      try {
        if (file.exists) {
          file.delete();
        }
      } catch {
        // ignore
      }
      return;
    }

    const expected =
      normalizeTotalBytes(totalBytes) ??
      (Number(input.fileSize) > 0 ? Number(input.fileSize) : null);

    // Drop any leftover range temp before final verification.
    deleteRangePartQuiet(destination);

    const verification = verifyCompletedFile(file, expected, {
      downloadId: input.id,
    });

    if (!verification.ok) {
      try {
        deleteRangePartQuiet(destination);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // ignore
      }
      await this.fail(
        input,
        null,
        'FINAL_FILE_INVALID',
        verification.reason === 'missing'
          ? 'Downloaded file is missing.'
          : 'The downloaded file failed integrity checks.',
        generation,
        {
          destination,
          bytesWritten: 0,
          totalBytes: expected,
          pauseState: null,
          rangeValidators: null,
          wipePartial: true,
        },
      );
      return;
    }

    // Re-check after verification I/O — cancel may have landed.
    if (!this.isCurrentGeneration(generation)) {
      try {
        if (file.exists) {
          file.delete();
        }
      } catch {
        // ignore
      }
      return;
    }

    const finalSize = String(verification.size);
    const record: LocalDownloadRecord = {
      downloadId: input.id,
      sourceUrl: input.sourceUrl,
      fileName: sanitizeFileName(input.fileName),
      expectedFileSize: finalSize,
      localUri: file.uri || destination.uri,
      localState: 'complete',
      bytesWritten: verification.size,
      totalBytes: verification.size,
      pauseState: null,
      rangeValidators: null,
      multiRange: null,
      generation,
      errorCode: null,
      errorMessage: null,
      remoteStatus: 'COMPLETED',
      retryCount: 0,
      maxRetries: DOWNLOAD_ENGINE.maxAutoRetryAttempts,
      retryEligible: false,
      lastAttemptAt: null,
      nextRetryAt: null,
      updatedAt: new Date().toISOString(),
    };
    await upsertLocalRecord(record);

    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    const snapshot = toTransferSnapshot(
      input.id,
      {
        bytesWritten: verification.size,
        totalBytes: verification.size,
        progress: 100,
        bytesPerSecond: null,
        etaSeconds: 0,
      },
      record.localUri,
      'complete',
    );
    this.onProgress(snapshot);

    // File is local truth — always mark complete locally even if PATCH fails.
    try {
      await syncStatusImmediate(input.id, 'COMPLETED', {
        progress: 100,
        fileSize: finalSize,
        errorMessage: null,
      });
    } catch {
      // synchronizer already swallows; keep local complete
    }

    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    this.emit({
      type: 'completed',
      downloadId: input.id,
      localUri: record.localUri!,
      fileSize: finalSize,
      progress: 100,
    });
    this.emit({ type: 'status', downloadId: input.id, status: 'COMPLETED' });
  }

  private async fail(
    input: EnqueueInput,
    existing: LocalDownloadRecord | null,
    code: LocalDownloadRecord['errorCode'] & string,
    message: string,
    generation = (existing?.generation ?? 0) + 1,
    context?: {
      destination?: ReturnType<typeof resolveDestinationFile>;
      bytesWritten?: number;
      totalBytes?: number | null;
      pauseState?: LocalDownloadRecord['pauseState'];
      rangeValidators?: RangeValidators | null;
      multiRange?: MultiRangeTransferState | null;
      wipePartial?: boolean;
    },
  ): Promise<void> {
    if (this.active?.cancelled) {
      return;
    }

    const engineCode = code as NonNullable<LocalDownloadRecord['errorCode']>;
    const classification = classifyTransferFailure(
      new DownloadEngineError(engineCode, message),
    );
    const destination =
      context?.destination ?? resolveDestinationFile(input.id, input.fileName);

    // Always drop incomplete range temp files.
    deleteRangePartQuiet(destination);

    const wipe =
      context?.wipePartial === true ||
      engineCode === 'SOURCE_CHANGED' ||
      engineCode === 'RESUME_UNSUPPORTED' ||
      engineCode === 'RANGE_REJECTED' ||
      engineCode === 'INVALID_RANGE_RESPONSE' ||
      engineCode === 'PARTIAL_FILE_CORRUPT' ||
      engineCode === 'FINAL_FILE_INVALID' ||
      engineCode === 'MERGE_FAILED' ||
      engineCode === 'PART_SIZE_MISMATCH' ||
      engineCode === 'FINAL_SIZE_MISMATCH' ||
      engineCode === 'INVALID_RESOURCE' ||
      engineCode === 'AUTH_ERROR';

    let pauseState: LocalDownloadRecord['pauseState'] = null;
    let bytesWritten = 0;
    let localUri: string | null = null;
    let rangeValidators = context?.rangeValidators ?? existing?.rangeValidators ?? null;
    let multiRange: MultiRangeTransferState | null =
      context?.multiRange ?? existing?.multiRange ?? null;

    if (!wipe) {
      if (hasResumableMultiRange(multiRange)) {
        bytesWritten = sumMultiRangeDownloaded(multiRange!);
        localUri = destination.uri;
        pauseState = null;
      } else {
        const durable = buildDurablePauseState(
          input.sourceUrl,
          destination,
          context?.pauseState ?? existing?.pauseState,
          context?.bytesWritten ?? existing?.bytesWritten ?? 0,
        );
        if (durable) {
          try {
            assertDurablePauseReady(destination, durable, {
              requireBytes: parseAndroidResumeOffset(durable.resumeData) != null,
            });
            pauseState = durable;
            bytesWritten =
              parseAndroidResumeOffset(durable.resumeData) ??
              readPartialFileSize(destination);
            localUri = destination.uri;
            multiRange = null;
          } catch {
            // Partial unsafe — wipe rather than risk a corrupt append later.
            try {
              await deleteDownloadFiles(input.id);
            } catch {
              // ignore
            }
            pauseState = null;
            bytesWritten = 0;
            localUri = null;
            rangeValidators = null;
            multiRange = null;
          }
        } else if ((context?.bytesWritten ?? 0) <= 0) {
          // No durable bytes — clean empty job dir noise.
          try {
            await deleteDownloadFiles(input.id);
          } catch {
            // ignore
          }
          multiRange = null;
        }
      }
    } else {
      try {
        await cleanupMultiRangeWorkspace(input.id);
        await deleteDownloadFiles(input.id);
      } catch {
        // ignore
      }
      rangeValidators = null;
      multiRange = null;
    }

    const retryEligible = isManualRetryAllowed(engineCode);
    const record: LocalDownloadRecord = {
      downloadId: input.id,
      sourceUrl: input.sourceUrl,
      fileName: sanitizeFileName(input.fileName),
      expectedFileSize: input.fileSize,
      localUri,
      localState: 'failed',
      bytesWritten,
      totalBytes:
        context?.totalBytes ?? existing?.totalBytes ?? null,
      pauseState,
      rangeValidators,
      multiRange,
      generation,
      errorCode: engineCode,
      errorMessage: toUserFacingErrorMessage(engineCode, message),
      remoteStatus: 'FAILED',
      retryCount: existing?.retryCount ?? 0,
      maxRetries:
        existing?.maxRetries ?? DOWNLOAD_ENGINE.maxAutoRetryAttempts,
      retryEligible,
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt: null,
      updatedAt: new Date().toISOString(),
    };
    await upsertLocalRecord(record);

    const snapshot = toTransferSnapshot(
      input.id,
      {
        bytesWritten,
        totalBytes: record.totalBytes,
        progress:
          record.totalBytes != null && record.totalBytes > 0
            ? Math.min(
                99,
                Math.floor((bytesWritten / record.totalBytes) * 100),
              )
            : 0,
        bytesPerSecond: null,
        etaSeconds: null,
      },
      localUri,
      'failed',
      engineCode,
      record.errorMessage,
    );
    this.onProgress(snapshot);

    try {
      await syncStatusImmediate(input.id, 'FAILED', {
        errorCode: engineCode,
        errorMessage: record.errorMessage,
      });
    } catch {
      // ignore
    }

    this.emit({
      type: 'failed',
      downloadId: input.id,
      code: engineCode,
      message: record.errorMessage ?? message,
    });
    this.emit({
      type: 'status',
      downloadId: input.id,
      status: 'FAILED',
      errorMessage: record.errorMessage,
    });

    // Expose classification for manager auto-retry via local record fields.
    void classification;
  }
}

export async function cleanupCancelledDownload(downloadId: string): Promise<void> {
  clearSyncState(downloadId);
  await deleteDownloadFiles(downloadId);
}

/**
 * Basic unencrypted HLS transfer strategy.
 * Same progress/status/sync contract as progressive TransferWorker.
 */

import { File } from 'expo-file-system';

import {
  assertEnoughDiskSpace,
  deleteDownloadFiles,
  resolveDestinationFile,
  verifyCompletedFile,
} from '../file-paths';
import {
  classifyTransferError,
  DownloadEngineError,
  toUserFacingErrorMessage,
} from '../errors';
import { DOWNLOAD_ENGINE } from '../constants';
import { upsertLocalRecord } from '../persistence';
import {
  createProgressTracker,
  normalizeTotalBytes,
  toTransferSnapshot,
} from '../progress';
import { isManualRetryAllowed } from '../retry-policy';
import { isSafeHttpUrl, sanitizeFileName } from '../resource-guard';
import {
  syncProgressThrottled,
  syncStatusImmediate,
} from '../synchronizer';
import type {
  EnqueueInput,
  EngineEvent,
  HlsTransferState,
  LocalDownloadRecord,
  TransferProgressSnapshot,
} from '../types';
import { fetchAndParseHlsPlaylist } from './fetch-playlist';
import { cleanupHlsWorkspace } from './paths';
import { createHlsPersistGate, createEmptyHlsTransferState } from './persist-gate';
import {
  outputExtensionForHint,
  selectHlsVariant,
  type HlsMediaPlaylist,
} from './playlist';
import { isUnrecoverableHlsCode } from './segment-retry';
import {
  assembleHlsOutput,
  copyHlsAssembledFile,
  downloadHlsSegments,
} from './segment-transfer';
import { verifyAssembledHlsFile } from './verifier';

type Emit = (event: EngineEvent) => void;
type OnProgress = (snapshot: TransferProgressSnapshot) => void;

type ActiveHls = {
  downloadId: string;
  generation: number;
  abortController: AbortController;
  running: boolean;
  cancelled: boolean;
  /** Soft hold for Wi-Fi Only / offline — not user cancel, not failure. */
  networkPolicyHold: boolean;
};

function ensureOutputFileName(
  fileName: string,
  hint: 'ts' | 'fmp4',
): string {
  const sanitized = sanitizeFileName(fileName);
  const ext = outputExtensionForHint(hint);
  const lower = sanitized.toLowerCase();
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.m4s') ||
    lower.endsWith('.m3u8')
  ) {
    const base = sanitized.replace(/\.[^.]+$/, '') || 'download';
    return sanitizeFileName(`${base}.${ext}`);
  }
  if (sanitized.includes('.')) {
    return sanitized;
  }
  return sanitizeFileName(`${sanitized}.${ext}`);
}

/**
 * HLS transfer worker — one job at a time, sequential segments.
 * Pause is not supported (no native resumable segment session).
 */
export class HlsTransferWorker {
  private active: ActiveHls | null = null;

  constructor(
    private readonly emit: Emit,
    private readonly onProgress: OnProgress,
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

    const expectedBytes = Number(input.fileSize);
    assertEnoughDiskSpace(
      Number.isFinite(expectedBytes) && expectedBytes > 0 ? expectedBytes : 0,
    );

    const generation = (existing?.generation ?? 0) + 1;
    const abortController = new AbortController();
    const tracker = createProgressTracker();

    let bytesWritten = 0;
    let totalBytes: number | null = normalizeTotalBytes(
      Number(input.fileSize) > 0 ? Number(input.fileSize) : null,
    );
    let destinationUri: string | null = null;
    let hlsState: HlsTransferState = createEmptyHlsTransferState();
    let persistHls: (state: HlsTransferState, force: boolean) => Promise<void> =
      async () => {};

    const publishProgress = (
      force = false,
      localState: TransferProgressSnapshot['localState'] = 'transferring',
    ) => {
      if (!this.isCurrentGeneration(generation) && !force) {
        return null;
      }
      const noted = force
        ? tracker.forceComplete(bytesWritten, totalBytes)
        : tracker.note(bytesWritten, totalBytes);
      const snapshot = toTransferSnapshot(
        input.id,
        noted,
        destinationUri,
        localState,
      );
      const shouldUpdateUi =
        force || !('shouldUpdateUi' in noted) || noted.shouldUpdateUi;
      const knownTotal = normalizeTotalBytes(totalBytes);
      const shouldUpdateBackend =
        !force &&
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
      abortController,
      running: true,
      cancelled: false,
      networkPolicyHold: false,
    };

    try {
      const reuseWorkspace =
        existing?.sourceUrl === input.sourceUrl &&
        existing.hlsTransfer != null &&
        existing.hlsTransfer.completedSegments > 0;

      if (!reuseWorkspace) {
        await cleanupHlsWorkspace(input.id);
      }

      hlsState =
        reuseWorkspace && existing?.hlsTransfer
          ? { ...existing.hlsTransfer }
          : createEmptyHlsTransferState();
      const persistGate = createHlsPersistGate();

      persistHls = async (state: HlsTransferState, force: boolean) => {
        hlsState = state;
        if (!this.isCurrentGeneration(generation) && !force) {
          return;
        }
        if (!persistGate.shouldPersist(state.completedSegments, Date.now(), force)) {
          return;
        }
        await upsertLocalRecord({
          downloadId: input.id,
          sourceUrl: input.sourceUrl,
          fileName: sanitizeFileName(input.fileName),
          expectedFileSize: input.fileSize,
          localUri: destinationUri,
          localState: 'transferring',
          bytesWritten: state.downloadedBytes,
          totalBytes,
          pauseState: null,
          rangeValidators: null,
          generation,
          errorCode: null,
          errorMessage: null,
          remoteStatus: 'DOWNLOADING',
          retryCount: existing?.retryCount ?? 0,
          maxRetries:
            existing?.maxRetries ?? DOWNLOAD_ENGINE.maxAutoRetryAttempts,
          retryEligible: true,
          lastAttemptAt: existing?.lastAttemptAt ?? null,
          nextRetryAt: null,
          updatedAt: new Date().toISOString(),
          hlsTransfer: state,
        });
      };

      await upsertLocalRecord({
        downloadId: input.id,
        sourceUrl: input.sourceUrl,
        fileName: sanitizeFileName(input.fileName),
        expectedFileSize: input.fileSize,
        localUri: null,
        localState: 'transferring',
        bytesWritten: hlsState.downloadedBytes,
        totalBytes,
        pauseState: null,
        rangeValidators: null,
        generation,
        errorCode: null,
        errorMessage: null,
        remoteStatus: 'DOWNLOADING',
        retryCount: existing?.retryCount ?? 0,
        maxRetries:
          existing?.maxRetries ?? DOWNLOAD_ENGINE.maxAutoRetryAttempts,
        retryEligible: true,
        lastAttemptAt: existing?.lastAttemptAt ?? null,
        nextRetryAt: null,
        updatedAt: new Date().toISOString(),
        hlsTransfer: hlsState,
      });

      if (!this.isCurrentGeneration(generation)) {
        return;
      }

      this.emit({ type: 'status', downloadId: input.id, status: 'DOWNLOADING' });
      await syncStatusImmediate(input.id, 'DOWNLOADING');

      if (!this.isCurrentGeneration(generation)) {
        return;
      }

      const media = await this.resolveMediaPlaylist(
        input.sourceUrl,
        abortController.signal,
      );

      if (!this.isCurrentGeneration(generation)) {
        return;
      }

      const outputName = ensureOutputFileName(input.fileName, media.containerHint);
      const destination = resolveDestinationFile(input.id, outputName);
      destinationUri = destination.uri;

      try {
        if (destination.exists) {
          destination.delete();
        }
      } catch {
        // continue
      }

      const transfer = await downloadHlsSegments({
        downloadId: input.id,
        media,
        signal: abortController.signal,
        onCheckpoint: (state, force) => {
          void persistHls(state, force).catch(() => {
            // Local persist must not abort a healthy transfer.
          });
        },
        onProgress: (event) => {
          if (!this.isCurrentGeneration(generation)) {
            return;
          }
          bytesWritten = event.bytesWritten;
          if (event.totalBytes != null && event.totalBytes > 0) {
            totalBytes = event.totalBytes;
          }

          // When byte totals are unknown, segment completion is still a real ratio.
          if (
            (totalBytes == null || totalBytes <= 0) &&
            event.totalSegments > 0
          ) {
            const ratio = event.completedSegments / event.totalSegments;
            const progress = Math.max(
              0,
              Math.min(99, Math.floor(ratio * 100)),
            );
            const noted = tracker.note(bytesWritten, null);
            const snapshot = toTransferSnapshot(
              input.id,
              {
                bytesWritten,
                totalBytes: null,
                progress,
                bytesPerSecond: noted.bytesPerSecond,
                etaSeconds: null,
              },
              destinationUri,
              'transferring',
            );
            if (noted.shouldUpdateUi) {
              this.onProgress(snapshot);
            }
            if (noted.shouldUpdateBackend && progress > 0) {
              syncProgressThrottled(input.id, progress);
            }
            return;
          }

          publishProgress(false, 'transferring');
        },
      });

      if (!this.isCurrentGeneration(generation)) {
        return;
      }

      await persistHls(
        {
          ...hlsState,
          completedSegments: transfer.plan.totalSegments,
          downloadedBytes: bytesWritten,
          currentSegment: null,
        },
        true,
      );

      const assembled = await assembleHlsOutput({
        downloadId: input.id,
        media,
        plan: transfer.plan,
        signal: abortController.signal,
      });

      if (!this.isCurrentGeneration(generation)) {
        return;
      }

      // Move assembled temp → final destination without loading the full VOD.
      try {
        if (destination.exists) {
          destination.delete();
        }
      } catch {
        // continue
      }

      copyHlsAssembledFile(assembled, destination, abortController.signal);
      verifyAssembledHlsFile(destination, input.id);

      try {
        if (assembled.exists) {
          assembled.delete();
        }
      } catch {
        // Workspace cleanup still runs on completion / cancel.
      }

      await this.complete(input, destination, generation, outputName);
    } catch (error) {
      if (!this.active || this.active.generation !== generation) {
        return;
      }
      if (this.active.networkPolicyHold) {
        this.active.running = false;
        try {
          await persistHls(hlsState, true);
        } catch {
          // ignore
        }
        await this.settleNetworkPolicyHold(
          input,
          existing,
          generation,
          hlsState,
          destinationUri,
          totalBytes,
        );
        return;
      }
      if (this.active.cancelled || abortController.signal.aborted) {
        this.active.running = false;
        return;
      }
      const classified = classifyTransferError(error);
      if (classified.code === 'CANCELLED') {
        this.active.running = false;
        try {
          await persistHls(hlsState, true);
        } catch {
          // ignore
        }
        return;
      }
      await this.fail(
        input,
        existing,
        classified.code,
        classified.message,
        generation,
        hlsState,
      );
    } finally {
      if (this.active?.generation === generation) {
        this.active.running = false;
        if (!this.active.cancelled) {
          this.active = null;
        }
      }
    }
  }

  private async resolveMediaPlaylist(
    sourceUrl: string,
    signal: AbortSignal,
  ): Promise<HlsMediaPlaylist> {
    const first = await fetchAndParseHlsPlaylist(sourceUrl, signal);
    if (first.playlist.kind === 'media') {
      return first.playlist;
    }

    const variant = selectHlsVariant(first.playlist.variants, sourceUrl);
    const second = await fetchAndParseHlsPlaylist(variant.url, signal);
    if (second.playlist.kind !== 'media') {
      throw new DownloadEngineError(
        'INVALID_HLS_PLAYLIST',
        'HLS variant did not resolve to a media playlist.',
      );
    }
    return second.playlist;
  }

  async pause(_downloadId: string): Promise<boolean> {
    // No native resumable HLS session — do not fake pause/resume.
    throw new DownloadEngineError(
      'RESUME_UNSUPPORTED',
      'Pause isn’t supported for HLS downloads.',
    );
  }

  /**
   * Soft-hold for Wi-Fi Only / offline: abort bytes, keep workspace,
   * persist PAUSED (not FAILED/CANCELLED) so scheduler can resume later.
   */
  async holdForNetworkPolicy(downloadId: string): Promise<boolean> {
    if (!this.active || this.active.downloadId !== downloadId) {
      return false;
    }
    if (this.active.cancelled) {
      return false;
    }
    this.active.networkPolicyHold = true;
    try {
      this.active.abortController.abort();
    } catch {
      // ignore
    }
    return true;
  }

  async cancel(downloadId: string): Promise<boolean> {
    if (!this.active || this.active.downloadId !== downloadId) {
      return false;
    }
    this.active.cancelled = true;
    this.active.running = false;
    try {
      this.active.abortController.abort();
    } catch {
      // ignore
    }
    return true;
  }

  private async settleNetworkPolicyHold(
    input: EnqueueInput,
    existing: LocalDownloadRecord | null,
    generation: number,
    hlsState: HlsTransferState,
    destinationUri: string | null,
    totalBytes: number | null,
  ): Promise<void> {
    const record: LocalDownloadRecord = {
      downloadId: input.id,
      sourceUrl: input.sourceUrl,
      fileName: sanitizeFileName(input.fileName),
      expectedFileSize: input.fileSize,
      localUri: destinationUri,
      localState: 'paused',
      bytesWritten: hlsState.downloadedBytes,
      totalBytes: totalBytes ?? existing?.totalBytes ?? null,
      pauseState: null,
      rangeValidators: null,
      generation,
      errorCode: null,
      errorMessage: null,
      remoteStatus: 'PAUSED',
      retryCount: existing?.retryCount ?? 0,
      maxRetries:
        existing?.maxRetries ?? DOWNLOAD_ENGINE.maxAutoRetryAttempts,
      retryEligible: true,
      lastAttemptAt: existing?.lastAttemptAt ?? null,
      nextRetryAt: null,
      updatedAt: new Date().toISOString(),
      hlsTransfer: { ...hlsState, lastFailureReason: null },
    };
    await upsertLocalRecord(record);
    try {
      await syncStatusImmediate(input.id, 'PAUSED', {
        workerState: 'PAUSED',
      });
    } catch {
      // ignore
    }
    this.emit({ type: 'status', downloadId: input.id, status: 'PAUSED' });
    this.active = null;
  }

  private async complete(
    input: EnqueueInput,
    destination: File,
    generation: number,
    outputName: string,
  ): Promise<void> {
    if (!this.isCurrentGeneration(generation)) {
      try {
        if (destination.exists) {
          destination.delete();
        }
      } catch {
        // ignore
      }
      return;
    }

    const verification = verifyCompletedFile(destination, null, {
      downloadId: input.id,
    });
    if (!verification.ok) {
      try {
        if (destination.exists) {
          destination.delete();
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
          : 'Downloaded file failed integrity checks.',
        generation,
      );
      return;
    }

    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    await cleanupHlsWorkspace(input.id);

    const finalSize = String(verification.size);
    await upsertLocalRecord({
      downloadId: input.id,
      sourceUrl: input.sourceUrl,
      fileName: sanitizeFileName(outputName),
      expectedFileSize: finalSize,
      localUri: destination.uri,
      localState: 'complete',
      bytesWritten: verification.size,
      totalBytes: verification.size,
      pauseState: null,
      rangeValidators: null,
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
      hlsTransfer: null,
    });

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
      destination.uri,
      'complete',
    );
    this.onProgress(snapshot);

    try {
      await syncStatusImmediate(input.id, 'COMPLETED', {
        progress: 100,
        fileSize: finalSize,
        fileName: sanitizeFileName(outputName),
        errorMessage: null,
      });
    } catch {
      // local complete remains
    }

    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    this.emit({
      type: 'completed',
      downloadId: input.id,
      localUri: destination.uri,
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
    hlsState: HlsTransferState | null = existing?.hlsTransfer ?? null,
  ): Promise<void> {
    if (this.active?.cancelled) {
      return;
    }

    const engineCode = code as NonNullable<LocalDownloadRecord['errorCode']>;
    const wipeWorkspace = isUnrecoverableHlsCode(engineCode);

    if (wipeWorkspace) {
      try {
        await cleanupHlsWorkspace(input.id);
      } catch {
        // ignore
      }
      try {
        await deleteDownloadFiles(input.id);
      } catch {
        // ignore
      }
    }

    const record: LocalDownloadRecord = {
      downloadId: input.id,
      sourceUrl: input.sourceUrl,
      fileName: sanitizeFileName(input.fileName),
      expectedFileSize: input.fileSize,
      localUri: wipeWorkspace ? null : existing?.localUri ?? null,
      localState: 'failed',
      bytesWritten: wipeWorkspace ? 0 : (hlsState?.downloadedBytes ?? existing?.bytesWritten ?? 0),
      totalBytes: existing?.totalBytes ?? null,
      pauseState: null,
      rangeValidators: null,
      generation,
      errorCode: engineCode,
      errorMessage: toUserFacingErrorMessage(engineCode, message),
      remoteStatus: 'FAILED',
      retryCount: existing?.retryCount ?? 0,
      maxRetries:
        existing?.maxRetries ?? DOWNLOAD_ENGINE.maxAutoRetryAttempts,
      retryEligible: isManualRetryAllowed(engineCode),
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt: null,
      updatedAt: new Date().toISOString(),
      hlsTransfer: wipeWorkspace
        ? null
        : hlsState
          ? { ...hlsState, lastFailureReason: engineCode }
          : existing?.hlsTransfer ?? null,
    };
    await upsertLocalRecord(record);

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
  }
}

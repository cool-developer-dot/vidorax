import {
  DownloadStatus,
  DownloadWorkerState,
  type DownloadHistory,
  type Prisma,
} from '@prisma/client';
import {
  assertDownloadTransition,
  assertSafeFileName,
  isTerminalDownloadStatus,
  resolveWorkerStateForUpdate,
  sanitizeBitrate,
  sanitizeErrorCode,
  sanitizeErrorMessage,
  sanitizeQuality,
  sanitizeResolution,
} from '../domain/downloads/index.js';
import { publishDownloadEvent } from '../realtime/index.js';
import * as downloadRepository from '../repositories/download.repository.js';
import * as favoriteRepository from '../repositories/favorite.repository.js';
import type {
  CreateDownloadInput,
  DownloadItem,
  DownloadListFilters,
  UpdateDownloadInput,
} from '../types/download.types.js';
import { AppError } from '../utils/errors/index.js';
import {
  buildPaginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from '../utils/pagination.js';
import { InvalidUrlError, normalizeUrl } from '../utils/url.js';

const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n;
const PLATFORM_PATTERN = /^[A-Z][A-Z0-9_]{0,49}$/;

const toDownloadItem = (download: DownloadHistory): DownloadItem => ({
  id: download.id,
  userId: download.userId,
  title: download.title,
  sourceUrl: download.sourceUrl,
  platform: download.platform,
  thumbnailUrl: download.thumbnailUrl,
  fileName: download.fileName,
  folderId: download.folderId ?? null,
  fileSize: download.fileSize.toString(),
  status: download.status,
  progress: download.progress,
  quality: download.quality,
  resolution: download.resolution,
  bitrate: download.bitrate,
  retryCount: download.retryCount,
  workerState: download.workerState,
  errorCode: download.errorCode,
  errorMessage: download.errorMessage,
  downloadedAt: download.downloadedAt,
  createdAt: download.createdAt,
  updatedAt: download.updatedAt,
});

const resolveUrl = (value: string): string => {
  try {
    return normalizeUrl(value);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      throw new AppError(error.message, 400);
    }

    throw error;
  }
};

const resolvePlatform = (value: string): string => {
  const platform = value.trim().toUpperCase();

  if (!PLATFORM_PATTERN.test(platform)) {
    throw new AppError(
      'platform must be a valid uppercase identifier',
      400,
    );
  }

  return platform;
};

const resolveFileSize = (value: string | number | bigint): bigint => {
  let fileSize: bigint;

  try {
    if (
      typeof value === 'number' &&
      (!Number.isSafeInteger(value) || value < 0)
    ) {
      throw new Error('Unsafe file size');
    }

    if (typeof value === 'string' && !/^\d+$/.test(value)) {
      throw new Error('Invalid file size');
    }

    fileSize = BigInt(value);
  } catch {
    throw new AppError('fileSize must be a non-negative integer', 400);
  }

  if (fileSize < 0n || fileSize > MAX_DATABASE_BIGINT) {
    throw new AppError('fileSize is outside the supported range', 400);
  }

  return fileSize;
};

const requireDownload = async (
  userId: string,
  id: string,
): Promise<DownloadHistory> => {
  const download = await downloadRepository.findByIdForUser(id, userId);

  if (!download) {
    // Same 404 for missing and cross-user — no existence leak.
    throw new AppError('Download not found', 404);
  }

  return download;
};

const hasMetadataMutation = (
  existing: DownloadHistory,
  input: UpdateDownloadInput,
): boolean =>
  input.progress !== undefined ||
  input.fileName !== undefined ||
  input.fileSize !== undefined ||
  input.thumbnailUrl !== undefined ||
  input.errorCode !== undefined ||
  input.errorMessage !== undefined ||
  (input.workerState !== undefined &&
    input.workerState !== existing.workerState);

const applyUpdate = async (
  userId: string,
  id: string,
  input: UpdateDownloadInput,
): Promise<DownloadItem> => {
  const existing = await requireDownload(userId, id);
  const nextStatus = input.status ?? existing.status;

  assertDownloadTransition(existing.status, nextStatus);

  const statusChanging = nextStatus !== existing.status;

  // Terminal jobs are lifecycle-immutable. Same-status no-ops are idempotent
  // (including cancel/complete re-asserts with the same workerState).
  if (isTerminalDownloadStatus(existing.status)) {
    if (statusChanging || hasMetadataMutation(existing, input)) {
      throw new AppError(
        `Cannot modify a ${existing.status} download`,
        409,
      );
    }

    return toDownloadItem(existing);
  }

  if (
    input.progress !== undefined &&
    (input.progress < 0 ||
      input.progress > 100 ||
      !Number.isInteger(input.progress))
  ) {
    throw new AppError('progress must be an integer between 0 and 100', 400);
  }

  if (input.progress !== undefined && input.progress < existing.progress) {
    throw new AppError('Download progress cannot decrease', 409);
  }

  if (
    nextStatus === DownloadStatus.COMPLETED &&
    input.progress !== undefined &&
    input.progress !== 100
  ) {
    throw new AppError('Completed downloads must have 100% progress', 409);
  }

  const nextWorkerState = resolveWorkerStateForUpdate({
    currentStatus: existing.status,
    nextStatus,
    currentWorkerState: existing.workerState,
    requestedWorkerState:
      input.workerState === undefined ? undefined : input.workerState,
  });

  const data: Prisma.DownloadHistoryUpdateManyMutationInput = {};

  if (input.progress !== undefined) {
    data.progress = input.progress;
  }

  if (input.status !== undefined) {
    data.status = nextStatus;
  }

  if (input.fileName !== undefined) {
    data.fileName = assertSafeFileName(input.fileName);
  }

  if (input.fileSize !== undefined) {
    data.fileSize = resolveFileSize(input.fileSize);
  }

  if (input.thumbnailUrl !== undefined) {
    data.thumbnailUrl = resolveUrl(input.thumbnailUrl);
  }

  if (input.errorCode !== undefined) {
    data.errorCode = sanitizeErrorCode(input.errorCode);
  }

  if (input.errorMessage !== undefined) {
    data.errorMessage = sanitizeErrorMessage(input.errorMessage);
  }

  // Persist workerState when status changes, explicitly requested, or missing on row.
  if (
    statusChanging ||
    input.workerState !== undefined ||
    existing.workerState !== nextWorkerState
  ) {
    data.workerState = nextWorkerState;
  }

  if (nextStatus === DownloadStatus.COMPLETED) {
    data.status = DownloadStatus.COMPLETED;
    data.progress = 100;
    data.errorCode = null;
    data.errorMessage = null;
    data.workerState = DownloadWorkerState.COMPLETED;
    // Set once — never overwrite an existing completion timestamp.
    data.downloadedAt = existing.downloadedAt ?? new Date();
  }

  if (nextStatus === DownloadStatus.FAILED) {
    data.status = DownloadStatus.FAILED;
    // Preserve progress snapshot for retry/recovery — do not reset.
    if (input.workerState === undefined) {
      data.workerState = DownloadWorkerState.FAILED;
    }
  }

  if (
    existing.status === DownloadStatus.FAILED &&
    nextStatus === DownloadStatus.QUEUED
  ) {
    // Intentional retry: clear active failure fields; preserve progress;
    // server-owned increment — clients cannot assign arbitrary retryCount.
    data.status = DownloadStatus.QUEUED;
    data.errorCode = null;
    data.errorMessage = null;
    data.workerState = DownloadWorkerState.WAITING;
    data.retryCount = { increment: 1 };
  }

  if (nextStatus === DownloadStatus.CANCELLED) {
    data.status = DownloadStatus.CANCELLED;
    data.workerState = DownloadWorkerState.CANCELLED;
    // Preserve last meaningful progress snapshot.
  }

  if (Object.keys(data).length === 0) {
    return toDownloadItem(existing);
  }

  const updated = await downloadRepository.updateForUser(id, userId, data, {
    expectedUpdatedAt: existing.updatedAt,
    expectedStatus: existing.status,
  });

  if (!updated) {
    throw new AppError(
      'Download was modified by another request; retry the operation',
      409,
    );
  }

  const item = toDownloadItem(updated);
  // Durable write succeeded first — then fan-out realtime (transport only).
  publishDownloadEvent({
    userId,
    item,
    previous: {
      status: existing.status,
      progress: existing.progress,
      workerState: existing.workerState,
    },
  });
  return item;
};

export const createDownload = async (
  userId: string,
  input: CreateDownloadInput,
): Promise<DownloadItem> => {
  const download = await downloadRepository.create({
    title: input.title.trim(),
    sourceUrl: resolveUrl(input.sourceUrl),
    platform: resolvePlatform(input.platform),
    thumbnailUrl: resolveUrl(input.thumbnailUrl),
    fileName: assertSafeFileName(input.fileName),
    fileSize: resolveFileSize(input.fileSize),
    quality: sanitizeQuality(input.quality),
    resolution: sanitizeResolution(input.resolution),
    bitrate: sanitizeBitrate(input.bitrate),
    // Server-controlled defaults — never accept from client.
    status: DownloadStatus.QUEUED,
    progress: 0,
    retryCount: 0,
    workerState: DownloadWorkerState.WAITING,
    errorCode: null,
    errorMessage: null,
    downloadedAt: null,
    user: {
      connect: { id: userId },
    },
  });

  const item = toDownloadItem(download);
  publishDownloadEvent({
    userId,
    item,
    previous: null,
    forceType: 'download.queued',
  });
  return item;
};

export const listDownloads = async (
  userId: string,
  pagination: PaginationParams,
  filters: DownloadListFilters = {},
): Promise<PaginatedResult<DownloadItem>> => {
  const { items, total } = await downloadRepository.listForUser(
    userId,
    pagination,
    {
      search: filters.search?.trim() || undefined,
      status: filters.status,
      platform: filters.platform
        ? resolvePlatform(filters.platform)
        : undefined,
      sort: filters.sort ?? 'newest',
    },
  );

  return buildPaginatedResult(items.map(toDownloadItem), total, pagination);
};

export const getDownload = async (
  userId: string,
  id: string,
): Promise<DownloadItem> => {
  return toDownloadItem(await requireDownload(userId, id));
};

export const updateDownload = async (
  userId: string,
  id: string,
  input: UpdateDownloadInput,
): Promise<DownloadItem> => {
  return applyUpdate(userId, id, input);
};

/** Convenience wrappers — all delegate to the same transition implementation. */
export const pauseDownload = async (
  userId: string,
  id: string,
): Promise<DownloadItem> => {
  return applyUpdate(userId, id, {
    status: DownloadStatus.PAUSED,
    workerState: DownloadWorkerState.PAUSED,
  });
};

export const resumeDownload = async (
  userId: string,
  id: string,
): Promise<DownloadItem> => {
  return applyUpdate(userId, id, {
    status: DownloadStatus.DOWNLOADING,
    workerState: DownloadWorkerState.TRANSFERRING,
  });
};

export const retryDownload = async (
  userId: string,
  id: string,
): Promise<DownloadItem> => {
  return applyUpdate(userId, id, {
    status: DownloadStatus.QUEUED,
    errorCode: null,
    errorMessage: null,
    workerState: DownloadWorkerState.WAITING,
  });
};

export const completeDownload = async (
  userId: string,
  id: string,
): Promise<DownloadItem> => {
  return applyUpdate(userId, id, {
    status: DownloadStatus.COMPLETED,
    progress: 100,
    workerState: DownloadWorkerState.COMPLETED,
  });
};

export const failDownload = async (
  userId: string,
  id: string,
  error?: {
    errorCode?: string | null;
    errorMessage?: string | null;
    workerState?: DownloadWorkerState | null;
  },
): Promise<DownloadItem> => {
  return applyUpdate(userId, id, {
    status: DownloadStatus.FAILED,
    ...(error?.errorCode !== undefined ? { errorCode: error.errorCode } : {}),
    ...(error?.errorMessage !== undefined
      ? { errorMessage: error.errorMessage }
      : {}),
    workerState: error?.workerState ?? DownloadWorkerState.FAILED,
  });
};

export const cancelDownload = async (
  userId: string,
  id: string,
): Promise<DownloadItem> => {
  return applyUpdate(userId, id, {
    status: DownloadStatus.CANCELLED,
    workerState: DownloadWorkerState.CANCELLED,
  });
};

export const deleteDownload = async (
  userId: string,
  id: string,
): Promise<void> => {
  const existing = await downloadRepository.findByIdForUser(id, userId);

  if (!existing) {
    throw new AppError('Download not found', 404);
  }

  // Favorites are keyed by sourceUrl (not DownloadHistory FK). Match media delete.
  await favoriteRepository.deleteBySourceUrlForUser(
    userId,
    existing.sourceUrl,
  );

  const deleted = await downloadRepository.deleteForUser(id, userId);

  if (deleted === 0) {
    throw new AppError('Download not found', 404);
  }
};

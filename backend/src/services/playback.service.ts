import {
  PLAYBACK_CLIENT_TIMESTAMP_MAX_FUTURE_MS,
  PLAYBACK_POSITION_DURATION_TOLERANCE_SECONDS,
  PLAYBACK_RECENT_DEFAULT_LIMIT,
  computeProgressPercent,
  resolveCompletedState,
} from '../domain/playback/index.js';
import * as downloadRepository from '../repositories/download.repository.js';
import * as playbackRepository from '../repositories/playback.repository.js';
import type {
  PlaybackDto,
  UpdatePlaybackProgressInput,
} from '../types/playback.types.js';
import { AppError } from '../utils/errors/index.js';
import {
  buildPaginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from '../utils/pagination.js';

function toIso(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString();
}

function toDto(row: playbackRepository.PlaybackRecord): PlaybackDto {
  return {
    mediaId: row.mediaId,
    positionSeconds: row.positionSeconds,
    durationSeconds: row.durationSeconds,
    progressPercent: row.progressPercent,
    lastPlayedAt: toIso(row.lastPlayedAt),
    completed: row.completed,
    updatedAt: row.updatedAt.toISOString(),
    clientRevision: row.clientRevision,
  };
}

function parseOptionalIso(value: string | null | undefined, field: string): Date | null {
  if (value == null || value === '') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${field}`, 400);
  }
  return date;
}

/**
 * Sanitize client timestamps: reject invalid; clamp wildly future values to now.
 */
function sanitizeClientTimestamp(
  value: string | null | undefined,
  field: string,
  now = new Date(),
): Date | null {
  if (value == null || value === '') {
    return null;
  }
  const date = parseOptionalIso(value, field);
  if (!date) {
    return null;
  }
  const maxFuture = now.getTime() + PLAYBACK_CLIENT_TIMESTAMP_MAX_FUTURE_MS;
  if (date.getTime() > maxFuture) {
    return now;
  }
  return date;
}

function assertFiniteNonNegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError(`${field} must be a finite number`, 400);
  }
  if (value < 0) {
    throw new AppError(`${field} must be non-negative`, 400);
  }
  return value;
}

function validateProgressNumbers(
  positionSeconds: number,
  durationSeconds: number,
): void {
  assertFiniteNonNegative(positionSeconds, 'positionSeconds');
  assertFiniteNonNegative(durationSeconds, 'durationSeconds');

  if (
    durationSeconds > 0 &&
    positionSeconds > durationSeconds + PLAYBACK_POSITION_DURATION_TOLERANCE_SECONDS
  ) {
    throw new AppError('positionSeconds exceeds durationSeconds', 400);
  }
}

function parseClientRevision(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AppError('clientRevision must be a non-negative finite number', 400);
  }
  return Math.trunc(value);
}

function pickNewerLastPlayed(
  existing: Date | null | undefined,
  incoming: Date | null | undefined,
): Date | null | undefined {
  if (incoming === undefined) {
    return undefined;
  }
  if (incoming === null) {
    return existing ?? null;
  }
  if (!existing) {
    return incoming;
  }
  return incoming.getTime() >= existing.getTime() ? incoming : existing;
}

/**
 * Owned completed media only. Cross-user → 404 (no disclosure).
 */
async function requireOwnedCompletedMedia(
  userId: string,
  mediaId: string,
): Promise<void> {
  const media = await downloadRepository.findCompletedByIdForUser(mediaId, userId);
  if (!media) {
    throw new AppError('Media not found', 404);
  }
}

export async function getPlayback(
  userId: string,
  mediaId: string,
): Promise<PlaybackDto> {
  await requireOwnedCompletedMedia(userId, mediaId);

  const row = await playbackRepository.findByUserAndMedia(userId, mediaId);
  if (!row) {
    throw new AppError('Playback history not found', 404);
  }
  return toDto(row);
}

export async function updateProgress(
  userId: string,
  mediaId: string,
  input: UpdatePlaybackProgressInput,
): Promise<PlaybackDto> {
  await requireOwnedCompletedMedia(userId, mediaId);

  validateProgressNumbers(input.positionSeconds, input.durationSeconds);

  const now = new Date();
  // Validate / clamp optional client timestamps (offline sync).
  if (input.clientUpdatedAt !== undefined && input.clientUpdatedAt !== null) {
    sanitizeClientTimestamp(input.clientUpdatedAt, 'updatedAt', now);
  }

  const clientRevision = parseClientRevision(input.clientRevision);
  const existing = await playbackRepository.findByUserAndMedia(userId, mediaId);

  const intentionalReplay =
    input.replayReset === true &&
    input.positionSeconds < 15 &&
    input.markCompleted !== true;

  // Stale-write protection: older clientRevision must not overwrite newer DB state.
  if (
    existing &&
    clientRevision !== undefined &&
    clientRevision < existing.clientRevision &&
    !intentionalReplay
  ) {
    throw new AppError('Stale playback state', 409, {
      playback: toDto(existing),
    });
  }

  const progressPercent = computeProgressPercent(
    input.positionSeconds,
    input.durationSeconds,
  );

  const completed = resolveCompletedState({
    positionSeconds: input.positionSeconds,
    durationSeconds: input.durationSeconds,
    markCompleted: input.markCompleted === true,
    existingCompleted: existing?.completed === true,
    replayReset: intentionalReplay,
  });

  let lastPlayedAt: Date | null | undefined = undefined;
  if (input.lastPlayedAt !== undefined) {
    const sanitized = sanitizeClientTimestamp(
      input.lastPlayedAt,
      'lastPlayedAt',
      now,
    );
    lastPlayedAt = pickNewerLastPlayed(existing?.lastPlayedAt, sanitized);
  }

  const nextRevision =
    clientRevision !== undefined
      ? Math.max(clientRevision, existing?.clientRevision ?? 0)
      : (existing?.clientRevision ?? 0);

  const row = await playbackRepository.upsertForUserMedia(userId, mediaId, {
    positionSeconds: input.positionSeconds,
    durationSeconds: input.durationSeconds,
    progressPercent,
    lastPlayedAt,
    completed,
    clientRevision: nextRevision,
  });

  return toDto(row);
}

export async function listHistory(
  userId: string,
  pagination: PaginationParams,
): Promise<PaginatedResult<PlaybackDto>> {
  const { items, total } = await playbackRepository.listHistoryForUser(
    userId,
    pagination,
  );
  return buildPaginatedResult(items.map(toDto), total, pagination);
}

export async function listContinueWatching(
  userId: string,
  pagination: PaginationParams,
): Promise<PaginatedResult<PlaybackDto>> {
  const { items, total } =
    await playbackRepository.listContinueWatchingForUser(userId, pagination);
  return buildPaginatedResult(items.map(toDto), total, pagination);
}

export async function listRecent(
  userId: string,
  limit = PLAYBACK_RECENT_DEFAULT_LIMIT,
): Promise<{ items: PlaybackDto[] }> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || PLAYBACK_RECENT_DEFAULT_LIMIT, 1), 100);
  const items = await playbackRepository.listRecentForUser(userId, safeLimit);
  return { items: items.map(toDto) };
}

/**
 * Deletes PlaybackHistory only — never DownloadHistory or files.
 */
export async function deletePlayback(
  userId: string,
  mediaId: string,
): Promise<{ deleted: boolean }> {
  await requireOwnedCompletedMedia(userId, mediaId);

  const count = await playbackRepository.deleteForUserMedia(userId, mediaId);
  return { deleted: count > 0 };
}

import type { Response } from 'express';
import * as playbackService from '../services/playback.service.js';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import { AppError } from '../utils/errors/index.js';
import { parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response/index.js';
import { handleServiceError } from '../utils/handle-service-error.js';

const getUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  return req.user.sub;
};

export const getPlayback = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const result = await playbackService.getPlayback(
      getUserId(req),
      req.params.mediaId as string,
    );
    success(res, { playback: result });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const updateProgress = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const result = await playbackService.updateProgress(
      getUserId(req),
      req.params.mediaId as string,
      {
        positionSeconds: Number(req.body.positionSeconds),
        durationSeconds: Number(req.body.durationSeconds),
        clientUpdatedAt:
          typeof req.body.updatedAt === 'string' ? req.body.updatedAt : null,
        lastPlayedAt:
          typeof req.body.lastPlayedAt === 'string'
            ? req.body.lastPlayedAt
            : req.body.lastPlayedAt === null
              ? null
              : undefined,
        markCompleted: req.body.markCompleted === true,
        replayReset: req.body.replayReset === true,
        clientRevision:
          req.body.clientRevision === undefined || req.body.clientRevision === null
            ? undefined
            : Number(req.body.clientRevision),
      },
    );
    success(res, { playback: result });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const listHistory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const result = await playbackService.listHistory(
      getUserId(req),
      parsePagination(req.query as Record<string, unknown>),
    );
    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const listContinueWatching = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const result = await playbackService.listContinueWatching(
      getUserId(req),
      parsePagination(req.query as Record<string, unknown>),
    );
    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const listRecent = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const rawLimit = req.query.limit;
    const limit =
      typeof rawLimit === 'string' || typeof rawLimit === 'number'
        ? Number(rawLimit)
        : undefined;
    const result = await playbackService.listRecent(getUserId(req), limit);
    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const deletePlayback = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const result = await playbackService.deletePlayback(
      getUserId(req),
      req.params.mediaId as string,
    );
    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

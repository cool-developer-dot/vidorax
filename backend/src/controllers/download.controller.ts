import type { DownloadStatus } from '@prisma/client';
import type { Response } from 'express';
import * as downloadService from '../services/download.service.js';
import { analyzeUrl } from '../services/media-analysis/index.js';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import type { DownloadSort } from '../types/download.types.js';
import { handleServiceError } from '../utils/handle-service-error.js';
import { parsePagination } from '../utils/pagination.js';
import { created, success, unauthorized } from '../utils/response/index.js';

/**
 * Analyze a media URL. Does not create DownloadHistory.
 */
export const analyzeDownload = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const analysis = await analyzeUrl(req.body.url);
    success(res, { analysis });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const createDownload = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const download = await downloadService.createDownload(req.user.sub, {
      title: req.body.title,
      sourceUrl: req.body.sourceUrl,
      platform: req.body.platform,
      thumbnailUrl: req.body.thumbnailUrl,
      fileName: req.body.fileName,
      fileSize: req.body.fileSize,
      quality: req.body.quality,
      resolution: req.body.resolution,
      bitrate: req.body.bitrate,
    });

    created(res, { download });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const listDownloads = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await downloadService.listDownloads(
      req.user.sub,
      parsePagination(req.query as Record<string, unknown>),
      {
        search:
          typeof req.query.search === 'string' ? req.query.search : undefined,
        status:
          typeof req.query.status === 'string'
            ? (req.query.status as DownloadStatus)
            : undefined,
        platform:
          typeof req.query.platform === 'string'
            ? req.query.platform
            : undefined,
        sort:
          typeof req.query.sort === 'string'
            ? (req.query.sort as DownloadSort)
            : undefined,
      },
    );

    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const getDownload = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const download = await downloadService.getDownload(
      req.user.sub,
      req.params.id as string,
    );
    success(res, { download });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const updateDownload = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const download = await downloadService.updateDownload(
      req.user.sub,
      req.params.id as string,
      {
        progress: req.body.progress,
        status: req.body.status,
        fileName: req.body.fileName,
        fileSize: req.body.fileSize,
        thumbnailUrl: req.body.thumbnailUrl,
        errorCode: req.body.errorCode,
        errorMessage: req.body.errorMessage,
        workerState: req.body.workerState,
      },
    );

    success(res, { download });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const deleteDownload = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    await downloadService.deleteDownload(
      req.user.sub,
      req.params.id as string,
    );
    success(res, { message: 'Download metadata deleted' });
  } catch (error) {
    handleServiceError(error, res);
  }
};

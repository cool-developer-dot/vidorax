import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import * as browserHistoryService from '../services/browser-history.service.js';
import { created, success, unauthorized } from '../utils/response/index.js';
import { handleServiceError } from '../utils/handle-service-error.js';
import {
  DEFAULT_RECENT_URLS_LIMIT,
  parsePagination,
  type ListSort,
} from '../utils/pagination.js';

export const listHistory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await browserHistoryService.listHistory(
      req.user.sub,
      parsePagination(req.query as Record<string, unknown>),
      {
        search:
          typeof req.query.search === 'string' ? req.query.search : undefined,
        hostname:
          typeof req.query.hostname === 'string'
            ? req.query.hostname
            : undefined,
        sort:
          typeof req.query.sort === 'string'
            ? (req.query.sort as ListSort)
            : undefined,
      },
    );

    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const createHistory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const visitedAt =
      typeof req.body.visitedAt === 'string' ? new Date(req.body.visitedAt) : undefined;

    const entry = await browserHistoryService.createHistory(req.user.sub, {
      url: req.body.url,
      title: req.body.title,
      visitedAt,
    });

    created(res, { history: entry });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const getRecentUrls = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const limit =
      typeof req.query.limit === 'string'
        ? Number(req.query.limit)
        : DEFAULT_RECENT_URLS_LIMIT;

    const urls = await browserHistoryService.getRecentUrls(req.user.sub, limit);
    success(res, { urls });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const clearHistory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const result = await browserHistoryService.clearHistory(req.user.sub);
    success(res, result);
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const deleteHistory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    await browserHistoryService.deleteHistoryEntry(
      req.user.sub,
      req.params.id as string,
    );
    success(res, { message: 'History entry deleted' });
  } catch (error) {
    handleServiceError(error, res);
  }
};

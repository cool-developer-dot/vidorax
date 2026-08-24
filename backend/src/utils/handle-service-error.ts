import type { Response } from 'express';
import {
  conflict,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from '../utils/response/index.js';
import { AppError } from '../utils/errors/index.js';

function readErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Map service-layer failures to HTTP responses.
 * Always log unexpected errors — silent 500s hide Prisma client/schema drift.
 */
export const handleServiceError = (error: unknown, res: Response): void => {
  if (error instanceof AppError) {
    switch (error.statusCode) {
      case 400:
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      case 401:
        unauthorized(res, error.message);
        return;
      case 403:
        forbidden(res, error.message);
        return;
      case 404:
        notFound(res, error.message);
        return;
      case 409:
        conflict(res, error.message, error.data);
        return;
      default:
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
        return;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : 'Error';
  const code = readErrorCode(error);

  console.error('Unhandled service error', {
    name,
    message,
    code,
  });

  // Prisma client/schema drift (e.g. stale global cache missing clientRevision)
  // remains a 500 — operators must regenerate/restart — but must never be silent.
  serverError(res);
};

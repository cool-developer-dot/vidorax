import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors/index.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) {
    _next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  const status =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof err.status === 'number'
      ? err.status
      : 500;

  if (status === 400 && err instanceof SyntaxError) {
    res.status(400).json({
      success: false,
      error: 'Malformed JSON request body',
    });
    return;
  }

  console.error('Unhandled request error', {
    name: err instanceof Error ? err.name : 'Error',
    message: err instanceof Error ? err.message : 'unknown',
  });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};

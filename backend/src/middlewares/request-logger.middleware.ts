import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';

export const requestLogger = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const startedAt = process.hrtime.bigint();

  res.once('finish', () => {
    const elapsedMilliseconds =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    console.info(
      JSON.stringify({
        method: req.method,
        route: req.originalUrl.split('?')[0],
        statusCode: res.statusCode,
        responseTimeMs: Number(elapsedMilliseconds.toFixed(2)),
        userId: req.user?.sub ?? null,
      }),
    );
  });

  next();
};

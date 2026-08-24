import type { NextFunction, RequestHandler, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';

type AsyncRequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const asyncHandler = (
  handler: AsyncRequestHandler,
): RequestHandler => {
  return (req, res, next): void => {
    void handler(req, res, next).catch(next);
  };
};

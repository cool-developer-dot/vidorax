import type { Response } from 'express';

export const conflict = (
  res: Response,
  message = 'Conflict',
  data?: unknown,
): void => {
  res.status(409).json({
    success: false,
    error: message,
    ...(data !== undefined ? { data } : {}),
  });
};

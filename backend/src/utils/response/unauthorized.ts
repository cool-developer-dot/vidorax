import type { Response } from 'express';

export const unauthorized = (
  res: Response,
  message = 'Unauthorized',
): void => {
  res.status(401).json({
    success: false,
    error: message,
  });
};

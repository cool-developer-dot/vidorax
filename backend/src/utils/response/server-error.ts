import type { Response } from 'express';

export const serverError = (
  res: Response,
  message = 'Internal server error',
): void => {
  res.status(500).json({
    success: false,
    error: message,
  });
};

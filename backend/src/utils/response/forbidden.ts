import type { Response } from 'express';

export const forbidden = (res: Response, message = 'Forbidden'): void => {
  res.status(403).json({
    success: false,
    error: message,
  });
};

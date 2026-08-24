import type { Response } from 'express';

export const notFound = (res: Response, message = 'Not found'): void => {
  res.status(404).json({
    success: false,
    error: message,
  });
};

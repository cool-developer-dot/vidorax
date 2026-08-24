import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { validationError } from '../utils/response/index.js';

export const validate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    validationError(res, errors.array());
    return;
  }

  next();
};

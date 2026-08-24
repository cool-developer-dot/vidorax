import type { Response } from 'express';
import { success } from './success.js';

export const created = <T>(res: Response, data: T): void => {
  success(res, data, 201);
};

import type { Response } from 'express';
import type { ValidationError } from 'express-validator';

type SafeValidationDetail = {
  type?: string;
  msg: string;
  path?: string;
  location?: string;
};

/**
 * Returns validation failures without echoing submitted field values
 * (passwords, tokens, etc. must never appear in API responses).
 */
export const validationError = (
  res: Response,
  errors: ValidationError[] | ValidationError,
): void => {
  const raw = Array.isArray(errors) ? errors : [errors];

  const details: SafeValidationDetail[] = raw.map((error) => {
    if (error.type === 'field') {
      return {
        type: error.type,
        msg: error.msg,
        path: error.path,
        location: error.location,
      };
    }

    return {
      type: error.type,
      msg: error.msg,
    };
  });

  res.status(400).json({
    success: false,
    error: 'Validation failed',
    details,
  });
};

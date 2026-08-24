import { body } from 'express-validator';

export const refreshValidator = [
  body('refreshToken')
    .isString()
    .withMessage('refreshToken is required')
    .trim()
    .notEmpty()
    .withMessage('refreshToken is required'),
];

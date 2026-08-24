import { body } from 'express-validator';

const PASSWORD_MAX_LENGTH = 72;

export const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: PASSWORD_MAX_LENGTH })
    .withMessage(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters`),
];

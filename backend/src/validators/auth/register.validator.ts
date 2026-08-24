import { body } from 'express-validator';

/** bcrypt truncates beyond 72 bytes; reject oversized passwords early. */
const PASSWORD_MAX_LENGTH = 72;

export const registerValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: PASSWORD_MAX_LENGTH })
    .withMessage(
      `Password must be between 8 and ${PASSWORD_MAX_LENGTH} characters`,
    ),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
];

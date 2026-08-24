import { body } from 'express-validator';

/**
 * Profile PATCH accepts name only.
 * Avatar mutations must use the signed upload / commit / delete endpoints.
 */
export const updateProfileValidator = [
  body('name')
    .optional()
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('avatarUrl')
    .not()
    .exists()
    .withMessage(
      'avatarUrl cannot be set via profile update; use the avatar upload endpoints',
    ),
];

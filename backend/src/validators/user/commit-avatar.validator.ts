import { body } from 'express-validator';

export const commitAvatarValidator = [
  body('path')
    .isString()
    .withMessage('path must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('path is required')
    .bail()
    .isLength({ max: 200 })
    .withMessage('path is not a valid avatar object path')
    .matches(/^[A-Za-z0-9_-]+-\d{10,17}\.jpg$/)
    .withMessage('path is not a valid avatar object path'),
];

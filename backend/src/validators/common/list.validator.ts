import { param, query, type ValidationChain } from 'express-validator';
import { MAX_PAGE_LIMIT } from '../../utils/pagination.js';

export const paginationQueryValidator: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: MAX_PAGE_LIMIT })
    .withMessage(`limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset must be a non-negative integer'),
];

export const searchQueryValidator: ValidationChain[] = [
  query('search')
    .optional()
    .isString()
    .withMessage('search must be a string')
    .trim()
    .isLength({ max: 255 })
    .withMessage('search must not exceed 255 characters'),
];

export const sortQueryValidator = (
  allowed: readonly string[] = ['newest', 'oldest', 'alphabetical'],
): ValidationChain => {
  return query('sort')
    .optional()
    .isIn(allowed)
    .withMessage(`sort must be one of: ${allowed.join(', ')}`);
};

export const idParamValidator: ValidationChain[] = [
  param('id').isUUID().withMessage('id must be a valid UUID'),
];

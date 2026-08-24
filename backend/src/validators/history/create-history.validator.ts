import { body, query } from 'express-validator';
import { MAX_PAGE_LIMIT } from '../../utils/pagination.js';
import {
  idParamValidator,
  paginationQueryValidator,
  searchQueryValidator,
  sortQueryValidator,
} from '../common/index.js';

export const listHistoryValidator = [
  ...paginationQueryValidator,
  ...searchQueryValidator,
  query('hostname')
    .optional()
    .isString()
    .withMessage('hostname must be a string')
    .trim()
    .notEmpty()
    .withMessage('hostname cannot be empty')
    .isLength({ max: 253 })
    .withMessage('hostname must not exceed 253 characters'),
  sortQueryValidator(),
];

export const recentHistoryValidator = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: MAX_PAGE_LIMIT })
    .withMessage(`limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`),
];

export const deleteHistoryValidator = idParamValidator;

/** Aligns with practical browser URL limits and download validators. */
const MAX_URL_LENGTH = 2048;

export const createHistoryValidator = [
  body('url')
    .trim()
    .notEmpty()
    .withMessage('URL is required')
    .isLength({ max: MAX_URL_LENGTH })
    .withMessage(`URL must not exceed ${MAX_URL_LENGTH} characters`)
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage('A valid http(s) URL is required'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 255 })
    .withMessage('Title must not exceed 255 characters'),
  body('visitedAt')
    .optional()
    .isISO8601()
    .withMessage('visitedAt must be a valid ISO-8601 datetime'),
];

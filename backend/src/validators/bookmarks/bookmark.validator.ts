import { body } from 'express-validator';
import {
  idParamValidator,
  paginationQueryValidator,
  searchQueryValidator,
  sortQueryValidator,
} from '../common/index.js';

/** Aligns with practical browser URL limits and history validators. */
const MAX_URL_LENGTH = 2048;

const optionalHttpUrlOrNull = (field: string) =>
  body(field)
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) {
        return true;
      }

      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${field} must be a valid URL or null`);
      }

      if (value.trim().length > MAX_URL_LENGTH) {
        throw new Error(`${field} must not exceed ${MAX_URL_LENGTH} characters`);
      }

      try {
        const parsed = new URL(value.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error(`${field} must use http or https`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith(field)) {
          throw error;
        }
        throw new Error(`${field} must be a valid URL or null`);
      }

      return true;
    });

export const listBookmarksValidator = [
  ...paginationQueryValidator,
  ...searchQueryValidator,
  sortQueryValidator(),
];

export const deleteBookmarkValidator = idParamValidator;

export const createBookmarkValidator = [
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
  optionalHttpUrlOrNull('faviconUrl'),
];

export const updateBookmarkValidator = [
  ...idParamValidator,
  body('url')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('URL cannot be empty')
    .isLength({ max: MAX_URL_LENGTH })
    .withMessage(`URL must not exceed ${MAX_URL_LENGTH} characters`)
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage('A valid http(s) URL is required'),
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Title must not exceed 255 characters'),
  optionalHttpUrlOrNull('faviconUrl'),
];

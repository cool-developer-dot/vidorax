import { body, param, query } from 'express-validator';
import {
  DOWNLOAD_STATUSES,
  DOWNLOAD_WORKER_STATES,
} from '../../types/download.types.js';
import {
  paginationQueryValidator,
  searchQueryValidator,
  sortQueryValidator,
} from '../common/index.js';

const CREATE_FIELDS = new Set([
  'title',
  'sourceUrl',
  'platform',
  'thumbnailUrl',
  'fileName',
  'fileSize',
  'quality',
  'resolution',
  'bitrate',
]);

const ANALYZE_FIELDS = new Set(['url']);

const UPDATE_FIELDS = new Set([
  'progress',
  'status',
  'fileName',
  'fileSize',
  'thumbnailUrl',
  'errorCode',
  'errorMessage',
  'workerState',
]);

const isValidFileSize = (value: unknown): boolean => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0;
  }

  return (
    typeof value === 'string' &&
    /^\d+$/.test(value) &&
    BigInt(value) <= 9_223_372_036_854_775_807n
  );
};

const isSafeLogicalFileName = (value: string): boolean => {
  if (!value || value.length > 255) {
    return false;
  }

  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }

  return !(
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\') ||
    /^[A-Za-z]:/.test(value) ||
    value.startsWith('~')
  );
};

const httpUrlValidator = (field: string) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${field} is required`)
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage(`${field} must be a valid http(s) URL`);

const optionalNullableQuality = body('quality')
  .optional({ nullable: true })
  .custom((value) => {
    if (value === null || value === undefined) {
      return true;
    }
    return typeof value === 'string' && value.trim().length <= 64;
  })
  .withMessage('quality must be a string ≤64 characters or null');

const optionalNullableResolution = body('resolution')
  .optional({ nullable: true })
  .custom((value) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value !== 'string') {
      return false;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return true;
    }
    return /^[1-9][0-9]{1,4}x[1-9][0-9]{1,4}$/i.test(trimmed);
  })
  .withMessage(
    'resolution must match WIDTHxHEIGHT with positive dimensions, or null',
  );

const optionalNullableBitrate = body('bitrate')
  .optional({ nullable: true })
  .custom((value) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) && value >= 0 && value <= 2_000_000_000;
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      const parsed = Number(value.trim());
      return (
        Number.isInteger(parsed) && parsed >= 0 && parsed <= 2_000_000_000
      );
    }
    return false;
  })
  .withMessage(
    'bitrate must be a non-negative integer ≤2000000000, or null',
  );

export const downloadIdValidator = [
  param('id').isUUID().withMessage('id must be a valid UUID'),
];

export const analyzeDownloadValidator = [
  body().custom((payload: Record<string, unknown>) => {
    const unknownFields = Object.keys(payload ?? {}).filter(
      (field) => !ANALYZE_FIELDS.has(field),
    );

    if (unknownFields.length > 0) {
      throw new Error(`Unknown field(s): ${unknownFields.join(', ')}`);
    }

    return true;
  }),
  body('url')
    .exists()
    .withMessage('url is required')
    .bail()
    .isString()
    .withMessage('url must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('url is required')
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage('url must be a valid http(s) URL'),
];

export const createDownloadValidator = [
  body().custom((payload: Record<string, unknown>) => {
    const unknownFields = Object.keys(payload).filter(
      (field) => !CREATE_FIELDS.has(field),
    );

    if (unknownFields.length > 0) {
      throw new Error(`Unknown field(s): ${unknownFields.join(', ')}`);
    }

    return true;
  }),
  body('title')
    .isString()
    .withMessage('title must be a string')
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .isLength({ max: 255 })
    .withMessage('title must not exceed 255 characters'),
  httpUrlValidator('sourceUrl'),
  body('platform')
    .isString()
    .withMessage('platform must be a string')
    .trim()
    .matches(/^[A-Za-z][A-Za-z0-9_]{0,49}$/)
    .withMessage('platform must be a valid platform identifier'),
  httpUrlValidator('thumbnailUrl'),
  body('fileName')
    .isString()
    .withMessage('fileName must be a string')
    .trim()
    .notEmpty()
    .withMessage('fileName is required')
    .isLength({ max: 255 })
    .withMessage('fileName must not exceed 255 characters')
    .custom(isSafeLogicalFileName)
    .withMessage(
      'fileName must be a logical name without path separators',
    ),
  body('fileSize')
    .exists()
    .withMessage('fileSize is required')
    .bail()
    .custom(isValidFileSize)
    .withMessage(
      'fileSize must be a non-negative integer within the supported range',
    ),
  optionalNullableQuality,
  optionalNullableResolution,
  optionalNullableBitrate,
];

export const updateDownloadValidator = [
  ...downloadIdValidator,
  body().custom((payload: Record<string, unknown>) => {
    const fields = Object.keys(payload);
    const unknownFields = fields.filter((field) => !UPDATE_FIELDS.has(field));

    if (unknownFields.length > 0) {
      throw new Error(`Unknown field(s): ${unknownFields.join(', ')}`);
    }

    if (fields.length === 0) {
      throw new Error('At least one update field is required');
    }

    return true;
  }),
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('progress must be an integer between 0 and 100')
    .toInt(),
  body('status')
    .optional()
    .isIn(DOWNLOAD_STATUSES)
    .withMessage(`status must be one of: ${DOWNLOAD_STATUSES.join(', ')}`),
  body('fileName')
    .optional()
    .isString()
    .withMessage('fileName must be a string')
    .trim()
    .notEmpty()
    .withMessage('fileName cannot be empty')
    .isLength({ max: 255 })
    .withMessage('fileName must not exceed 255 characters')
    .custom(isSafeLogicalFileName)
    .withMessage(
      'fileName must be a logical name without path separators',
    ),
  body('fileSize')
    .optional()
    .custom(isValidFileSize)
    .withMessage(
      'fileSize must be a non-negative integer within the supported range',
    ),
  body('thumbnailUrl')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('thumbnailUrl cannot be empty')
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage('thumbnailUrl must be a valid http(s) URL'),
  body('errorCode')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null) {
        return true;
      }

      return (
        typeof value === 'string' &&
        /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value.trim())
      );
    })
    .withMessage(
      'errorCode must be an uppercase identifier (e.g. NETWORK_TIMEOUT) or null',
    ),
  body('errorMessage')
    .optional({ nullable: true })
    .isString()
    .withMessage('errorMessage must be a string or null')
    .trim()
    .isLength({ max: 2000 })
    .withMessage('errorMessage must not exceed 2000 characters'),
  body('workerState')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) {
        return true;
      }
      return (
        typeof value === 'string' &&
        (DOWNLOAD_WORKER_STATES as readonly string[]).includes(value)
      );
    })
    .withMessage(
      `workerState must be one of: ${DOWNLOAD_WORKER_STATES.join(', ')}, or null`,
    ),
];

export const listDownloadsValidator = [
  ...paginationQueryValidator,
  ...searchQueryValidator,
  query('status')
    .optional()
    .isIn(DOWNLOAD_STATUSES)
    .withMessage(`status must be one of: ${DOWNLOAD_STATUSES.join(', ')}`),
  query('platform')
    .optional()
    .isString()
    .withMessage('platform must be a string')
    .trim()
    .matches(/^[A-Za-z][A-Za-z0-9_]{0,49}$/)
    .withMessage('platform must be a valid platform identifier'),
  sortQueryValidator(),
];

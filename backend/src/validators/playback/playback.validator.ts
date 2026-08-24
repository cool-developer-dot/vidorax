import { body, param, query } from 'express-validator';
import { paginationQueryValidator } from '../common/index.js';

export const mediaIdParamValidator = [
  param('mediaId').isUUID().withMessage('mediaId must be a valid UUID'),
];

export const getPlaybackValidator = [...mediaIdParamValidator];

export const deletePlaybackValidator = [...mediaIdParamValidator];

export const updateProgressValidator = [
  ...mediaIdParamValidator,
  body('positionSeconds')
    .exists()
    .withMessage('positionSeconds is required')
    .isFloat({ min: 0 })
    .withMessage('positionSeconds must be a non-negative finite number')
    .custom((value) => {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error('positionSeconds must be a non-negative finite number');
      }
      return true;
    }),
  body('durationSeconds')
    .exists()
    .withMessage('durationSeconds is required')
    .isFloat({ min: 0 })
    .withMessage('durationSeconds must be a non-negative finite number')
    .custom((value) => {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error('durationSeconds must be a non-negative finite number');
      }
      return true;
    }),
  body('updatedAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('updatedAt must be a valid ISO-8601 timestamp'),
  body('lastPlayedAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('lastPlayedAt must be a valid ISO-8601 timestamp'),
  body('markCompleted')
    .optional()
    .isBoolean()
    .withMessage('markCompleted must be a boolean'),
  body('replayReset')
    .optional()
    .isBoolean()
    .withMessage('replayReset must be a boolean'),
  body('clientRevision')
    .optional()
    .isInt({ min: 0 })
    .withMessage('clientRevision must be a non-negative integer'),
  body('progressPercent')
    .not()
    .exists()
    .withMessage('progressPercent must not be supplied'),
  body('userId')
    .not()
    .exists()
    .withMessage('userId must not be supplied'),
  body('localUri')
    .not()
    .exists()
    .withMessage('localUri must not be supplied'),
  body('sourceUrl')
    .not()
    .exists()
    .withMessage('sourceUrl must not be supplied'),
];

export const listPlaybackHistoryValidator = [...paginationQueryValidator];

export const listContinueWatchingValidator = [...paginationQueryValidator];

export const listRecentValidator = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100'),
];

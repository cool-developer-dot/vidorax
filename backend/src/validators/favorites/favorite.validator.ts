import { body, query } from 'express-validator';
import { FAVORITE_PLATFORMS } from '../../types/favorite.types.js';
import {
  idParamValidator,
  paginationQueryValidator,
  searchQueryValidator,
  sortQueryValidator,
} from '../common/index.js';

const CREATE_FIELDS = new Set([
  'title',
  'platform',
  'sourceUrl',
  'thumbnailUrl',
]);

export const createFavoriteValidator = [
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
  body('platform')
    .isIn(FAVORITE_PLATFORMS)
    .withMessage(`platform must be one of: ${FAVORITE_PLATFORMS.join(', ')}`),
  body('sourceUrl')
    .isString()
    .withMessage('sourceUrl must be a string')
    .trim()
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage('sourceUrl must be a valid http(s) URL'),
  body('thumbnailUrl')
    .isString()
    .withMessage('thumbnailUrl must be a string')
    .trim()
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage('thumbnailUrl must be a valid http(s) URL'),
];

export const listFavoritesValidator = [
  ...paginationQueryValidator,
  ...searchQueryValidator,
  query('platform')
    .optional()
    .isIn(FAVORITE_PLATFORMS)
    .withMessage(`platform must be one of: ${FAVORITE_PLATFORMS.join(', ')}`),
  sortQueryValidator(),
];

export const deleteFavoriteValidator = idParamValidator;

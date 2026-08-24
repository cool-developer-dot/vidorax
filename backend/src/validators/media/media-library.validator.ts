import { param, query } from 'express-validator';

import { MEDIA_LIBRARY_SORTS } from '../../types/media-library.types.js';
import { paginationQueryValidator } from '../common/index.js';

export const mediaIdValidator = [
  param('id').isUUID().withMessage('id must be a valid UUID'),
];

export const listMediaLibraryValidator = [
  ...paginationQueryValidator,
  query('sort')
    .optional()
    .isIn(MEDIA_LIBRARY_SORTS)
    .withMessage(`sort must be one of: ${MEDIA_LIBRARY_SORTS.join(', ')}`),
  query('favorite')
    .optional()
    .isIn(['true', 'false', '1', '0'])
    .withMessage('favorite must be true or false'),
  query('folderId')
    .optional()
    .isUUID()
    .withMessage('folderId must be a valid UUID'),
];

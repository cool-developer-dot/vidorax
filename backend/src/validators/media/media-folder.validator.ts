import { body } from 'express-validator';

import { idParamValidator } from '../common/index.js';

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;
const MAX_NAME_LEN = 100;

export const createMediaFolderValidator = [
  body('name')
    .isString()
    .withMessage('name must be a string')
    .trim()
    .notEmpty()
    .withMessage('name is required')
    .custom((value: string) => {
      if (CONTROL_CHARS_REGEX.test(value)) {
        throw new Error('name contains invalid characters');
      }
      if (value.length > MAX_NAME_LEN) {
        throw new Error(`name must not exceed ${MAX_NAME_LEN} characters`);
      }
      return true;
    }),
];

export const renameMediaFolderValidator = [
  ...idParamValidator,
  body('name')
    .isString()
    .withMessage('name must be a string')
    .trim()
    .notEmpty()
    .withMessage('name is required')
    .custom((value: string) => {
      if (CONTROL_CHARS_REGEX.test(value)) {
        throw new Error('name contains invalid characters');
      }
      return true;
    }),
];

export const deleteMediaFolderValidator = [...idParamValidator];

export const patchMediaFavoriteValidator = [
  ...idParamValidator,
  body('favorite')
    .isBoolean()
    .withMessage('favorite must be boolean'),
];

export const patchMediaFolderValidator = [
  ...idParamValidator,
  body('folderId')
    .custom((value: unknown) => {
      if (value === null) return true;
      if (typeof value !== 'string') return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      );
    })
    .withMessage('folderId must be a UUID string or null'),
];


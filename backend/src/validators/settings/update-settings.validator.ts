import { body } from 'express-validator';

const SUPPORTED_LANGUAGES = new Set([
  'en',
  'ur',
  'es',
  'fr',
  'de',
  'pt',
  'it',
  'ja',
  'ko',
  'zh',
  'ar',
  'hi',
  'ru',
  'tr',
  'nl',
  'pl',
  'sv',
  'id',
  'vi',
  'th',
  'uk',
]);

export const updateSettingsValidator = [
  body('theme')
    .optional()
    .isIn(['SYSTEM', 'LIGHT', 'DARK'])
    .withMessage('theme must be SYSTEM, LIGHT, or DARK'),
  body('language')
    .optional()
    .isString()
    .withMessage('language must be a string')
    .trim()
    .custom((value: string) => {
      const normalized = value.toLowerCase();
      if (!SUPPORTED_LANGUAGES.has(normalized)) {
        throw new Error('Unsupported language code');
      }
      return true;
    }),
  body('notificationsEnabled')
    .optional()
    .isBoolean()
    .withMessage('notificationsEnabled must be a boolean'),
  body('wifiOnlyDownloads')
    .optional()
    .isBoolean()
    .withMessage('wifiOnlyDownloads must be a boolean'),
  body('autoResumeDownloads')
    .optional()
    .isBoolean()
    .withMessage('autoResumeDownloads must be a boolean'),
  body('downloadDirectory')
    .optional()
    .isString()
    .withMessage('downloadDirectory must be a string')
    .trim()
    .notEmpty()
    .withMessage('downloadDirectory cannot be empty')
    .isLength({ max: 255 })
    .withMessage('downloadDirectory must not exceed 255 characters'),
];

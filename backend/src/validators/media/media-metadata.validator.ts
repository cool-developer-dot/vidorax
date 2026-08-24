import { body } from 'express-validator';
import { idParamValidator } from '../common/index.js';

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;
const MAX_DISPLAY_NAME_LEN = 255;

// Windows reserved device names (base only, extension ignored).
const RESERVED_BASE_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

function baseNameOf(value: string): string {
  const trimmed = value.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0) return trimmed.toUpperCase();
  return trimmed.slice(0, dot).toUpperCase();
}

function isSafeDisplayName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > MAX_DISPLAY_NAME_LEN) return false;
  if (CONTROL_CHARS_REGEX.test(trimmed)) return false;

  // Reject obvious traversal / absolute path attempts.
  if (
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.startsWith('..') ||
    /^\.+$/.test(trimmed) ||
    /^[A-Za-z]:/.test(trimmed) ||
    trimmed.startsWith('~')
  ) {
    return false;
  }

  if (trimmed === '.' || trimmed === '..') return false;
  if (trimmed.length === 0) return false;

  const base = baseNameOf(trimmed);
  if (RESERVED_BASE_NAMES.has(base)) return false;

  // Allow extension-less rename input; extension constraints are enforced in service.
  return true;
}

export const renameMediaValidator = [
  ...idParamValidator,
  body('displayName')
    .isString()
    .withMessage('displayName must be a string')
    .trim()
    .notEmpty()
    .withMessage('displayName is required')
    .isLength({ max: MAX_DISPLAY_NAME_LEN })
    .withMessage(`displayName must not exceed ${MAX_DISPLAY_NAME_LEN} characters`)
    .custom((value) => {
      if (typeof value !== 'string') return false;
      if (!isSafeDisplayName(value)) {
        throw new Error('displayName contains invalid or unsafe characters');
      }
      return true;
    }),
];

export const deleteMediaValidator = [...idParamValidator];


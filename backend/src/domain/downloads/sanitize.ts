import { AppError } from '../../utils/errors/index.js';
import { sanitizeUrlForLog } from '../../utils/url-security.js';

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const JWT_LIKE =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const AUTH_HEADER = /\bAuthorization\s*[:=]\s*[^\s,;]+/gi;
const COOKIE_HEADER = /\bCookie\s*[:=]\s*[^\n;]+/gi;
const STACK_LINE = /^\s*at\s+.+$/gm;
const ABSOLUTE_PATH =
  /(?:^|[\s"'`])((?:\/(?:Users|home|data|var|tmp|private|mnt|storage)\/|[A-Za-z]:\\)[^\s"'`]+)/g;

/**
 * Logical filename only — never absolute OS paths or traversal segments.
 */
export const assertSafeFileName = (raw: string): string => {
  const fileName = raw.trim();

  if (!fileName) {
    throw new AppError('fileName cannot be empty', 400);
  }

  if (fileName.length > 255) {
    throw new AppError('fileName must not exceed 255 characters', 400);
  }

  if (/[\u0000-\u001f\u007f]/.test(fileName)) {
    throw new AppError('fileName contains invalid control characters', 400);
  }

  if (
    fileName === '.' ||
    fileName === '..' ||
    /^\.+$/.test(fileName) ||
    fileName.startsWith('..') ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    /^[A-Za-z]:/.test(fileName) ||
    fileName.startsWith('~')
  ) {
    throw new AppError(
      'fileName must be a logical name without path separators',
      400,
    );
  }

  return fileName;
};

/**
 * Accept stable engine-style codes only (e.g. NETWORK_TIMEOUT).
 */
export const sanitizeErrorCode = (
  value: string | null | undefined,
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const code = value.trim().toUpperCase();

  if (!ERROR_CODE_PATTERN.test(code)) {
    throw new AppError(
      'errorCode must be an uppercase identifier (e.g. NETWORK_TIMEOUT)',
      400,
    );
  }

  return code;
};

const redactInlineUrls = (message: string): string =>
  message.replace(/\bhttps?:\/\/[^\s]+/gi, (match) => {
    try {
      return sanitizeUrlForLog(match);
    } catch {
      return '[redacted-url]';
    }
  });

/**
 * Persist concise, non-sensitive failure text only.
 */
export const sanitizeErrorMessage = (
  value: string | null | undefined,
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  let message = value.trim();

  if (!message) {
    return null;
  }

  message = message
    .replace(JWT_LIKE, '[redacted-jwt]')
    .replace(BEARER_TOKEN, 'Bearer [redacted]')
    .replace(AUTH_HEADER, 'Authorization: [redacted]')
    .replace(COOKIE_HEADER, 'Cookie: [redacted]')
    .replace(STACK_LINE, '')
    .replace(ABSOLUTE_PATH, ' [redacted-path]');

  message = redactInlineUrls(message)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (message.length > 2000) {
    message = `${message.slice(0, 2000)}…`;
  }

  return message || null;
};

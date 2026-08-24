/**
 * Pure sanitizers for Week 7 durable quality metadata.
 * Never invent values; unknown stays null.
 */

import { AppError } from '../../utils/errors/index.js';

const MAX_QUALITY_LENGTH = 64;
const RESOLUTION_PATTERN = /^[1-9][0-9]{1,4}x[1-9][0-9]{1,4}$/;
/** Soft product ceiling under PostgreSQL INT4; HLS BANDWIDTH stays well below. */
export const MAX_BITRATE_BPS = 2_000_000_000;
const MAX_DIMENSION = 16_384;

export const sanitizeQuality = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError('quality must be a string or null', 400);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > MAX_QUALITY_LENGTH) {
    throw new AppError(
      `quality must not exceed ${MAX_QUALITY_LENGTH} characters`,
      400,
    );
  }

  return trimmed;
};

export const sanitizeResolution = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError('resolution must be a string or null', 400);
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }

  // Reject sentinel unknowns — never persist invented placeholders.
  if (
    trimmed === 'unknown' ||
    trimmed === '0x0' ||
    trimmed === 'null' ||
    trimmed === 'undefined'
  ) {
    return null;
  }

  if (!RESOLUTION_PATTERN.test(trimmed)) {
    throw new AppError(
      'resolution must match WIDTHxHEIGHT with positive dimensions',
      400,
    );
  }

  const [widthRaw, heightRaw] = trimmed.split('x');
  const width = Number(widthRaw);
  const height = Number(heightRaw);

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 10 ||
    height < 10 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    throw new AppError('resolution dimensions are out of supported bounds', 400);
  }

  return `${width}x${height}`;
};

export const sanitizeBitrate = (
  value: number | string | null | undefined,
): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  let bitrate: number;

  if (typeof value === 'number') {
    bitrate = value;
  } else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    bitrate = Number(value.trim());
  } else {
    throw new AppError('bitrate must be a positive integer or null', 400);
  }

  if (!Number.isInteger(bitrate)) {
    throw new AppError('bitrate must be a positive integer or null', 400);
  }

  // 0 means unknown in some clients — coerce to null, never store 0.
  if (bitrate === 0) {
    return null;
  }

  if (bitrate < 1 || bitrate > MAX_BITRATE_BPS) {
    throw new AppError(
      `bitrate must be between 1 and ${MAX_BITRATE_BPS}`,
      400,
    );
  }

  return bitrate;
};

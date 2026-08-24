import type { ApiErrorCode, ValidationError } from './types';

export interface ApiErrorOptions {
  code: ApiErrorCode;
  status: number | null;
  message: string;
  details?: ValidationError[];
}

/**
 * Standardized typed error thrown by the networking layer.
 * Callers should catch `ApiError` instead of duplicating Axios error handling.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly details: ValidationError[];

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details ?? [];
  }

  get isUnauthorized(): boolean {
    return this.code === 'UNAUTHORIZED' || this.status === 401;
  }

  get isForbidden(): boolean {
    return this.code === 'FORBIDDEN' || this.status === 403;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }

  get isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR' || this.status === 400;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export type RemoteFailureClass = 'transient' | 'permanent' | 'auth';

/**
 * Classify backend/network failures so UI can degrade without retry/toast storms.
 * Transient: retry once, keep local data. Permanent: stop retrying. Auth: session path.
 */
export function classifyRemoteFailure(error: unknown): RemoteFailureClass {
  if (isApiError(error)) {
    if (error.isUnauthorized || error.isForbidden) {
      return 'auth';
    }
    if (error.isNetworkError || error.code === 'SERVER_ERROR') {
      return 'transient';
    }
    if (
      error.status === 429 ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    ) {
      return 'transient';
    }
    if (
      error.status === 400 ||
      error.status === 404 ||
      error.status === 409 ||
      error.status === 422
    ) {
      return 'permanent';
    }
    if (error.status != null && error.status >= 500) {
      return 'transient';
    }
    return 'permanent';
  }
  return 'transient';
}

export function mapStatusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'SERVER_ERROR';
    default:
      if (status >= 500) {
        return 'SERVER_ERROR';
      }
      return 'UNKNOWN';
  }
}

export function createApiError(options: ApiErrorOptions): ApiError {
  return new ApiError(options);
}

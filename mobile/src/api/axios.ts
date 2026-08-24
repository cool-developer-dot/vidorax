import {
  AxiosError,
  create,
  isAxiosError,
  isCancel,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { environment } from '@/constants/environment';
import { timeouts } from '@/constants/timeouts';

import { createApiError, mapStatusToCode } from './errors';
import { getAccessToken } from './token';
import type { ApiErrorBody, ValidationError } from './types';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
};

function resolveApiBaseUrl(): string {
  const root = environment.apiBaseUrl.replace(/\/+$/, '');
  return root.endsWith('/api') ? root : `${root}/api`;
}

export const apiClient: AxiosInstance = create({
  baseURL: resolveApiBaseUrl(),
  timeout: timeouts.apiRequest,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

function asObject(value: JsonValue | undefined): JsonObject | null {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
}

function parseValidationDetails(value: JsonValue | undefined): ValidationError[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const details: ValidationError[] = [];

  for (const item of value) {
    const record = asObject(item);
    if (!record) {
      continue;
    }

    const msg = typeof record.msg === 'string' ? record.msg : null;
    const path = typeof record.path === 'string' ? record.path : null;
    const location = typeof record.location === 'string' ? record.location : 'body';
    const type = typeof record.type === 'string' ? record.type : 'field';

    if (!msg || !path) {
      continue;
    }

    const detail: ValidationError = {
      type,
      msg,
      path,
      location,
    };

    // Never retain submitted field values client-side (passwords, etc.).
    details.push(detail);
  }

  return details;
}

function parseErrorBody(data: JsonValue | undefined): ApiErrorBody | null {
  const record = asObject(data);
  if (!record) {
    return null;
  }

  if (record.success !== false || typeof record.error !== 'string') {
    return null;
  }

  return {
    success: false,
    error: record.error,
    details: parseValidationDetails(record.details),
  };
}

function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not found';
    case 409:
      return 'Conflict';
    case 500:
      return 'Internal server error';
    default:
      return 'Unexpected server response';
  }
}

function toJsonValue(data: AxiosError['response']): JsonValue | undefined {
  if (!data) {
    return undefined;
  }

  const value = data.data;
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'object') {
    return value as JsonObject;
  }

  return undefined;
}

function toApiErrorFromAxios(error: AxiosError): ReturnType<typeof createApiError> {
  if (
    error.code === AxiosError.ECONNABORTED ||
    error.message.toLowerCase().includes('timeout')
  ) {
    return createApiError({
      code: 'TIMEOUT',
      status: null,
      message: 'Request timed out. Please try again.',
    });
  }

  if (!error.response) {
    return createApiError({
      code: 'NETWORK_ERROR',
      status: null,
      message: 'Network unavailable. Check your connection and try again.',
    });
  }

  const status = error.response.status;
  const body = parseErrorBody(toJsonValue(error.response));

  return createApiError({
    code: mapStatusToCode(status),
    status,
    message: body?.error ?? defaultMessageForStatus(status),
    details: body?.details,
  });
}

function isAuthCredentialRequest(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  );
}

apiClient.interceptors.request.use(
  async (
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> => {
    const headers = config.headers;

    headers.set('Accept', 'application/json');

    if (config.data !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = await getAccessToken();
    if (token && !isAuthCredentialRequest(config.url)) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return config;
  },
);

apiClient.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError | Error): Promise<AxiosResponse | never> => {
    // Preserve intentional aborts so callers can ignore superseded requests.
    if (isCancel(error) || (isAxiosError(error) && error.code === AxiosError.ERR_CANCELED)) {
      return Promise.reject(error);
    }

    if (!isAxiosError(error)) {
      return Promise.reject(
        createApiError({
          code: 'UNEXPECTED_RESPONSE',
          status: null,
          message: error.message || 'An unexpected error occurred',
        }),
      );
    }

    const original = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !original._skipAuthRefresh &&
      !isAuthCredentialRequest(original.url)
    ) {
      original._retry = true;

      try {
        const { refreshSession, tokenRefreshConfig } = await import(
          '@/services/auth/token-refresh.service'
        );
        const { clearSession } = await import(
          '@/services/auth/session.service'
        );

        if (!tokenRefreshConfig.enabled) {
          await clearSession();
          return Promise.reject(toApiErrorFromAxios(error));
        }

        await refreshSession();
        return apiClient(original);
      } catch {
        try {
          const { clearSession } = await import(
            '@/services/auth/session.service'
          );
          await clearSession();
        } catch {
          // Ignore secondary clear failures.
        }
        return Promise.reject(toApiErrorFromAxios(error));
      }
    }

    return Promise.reject(toApiErrorFromAxios(error));
  },
);

export { resolveApiBaseUrl };

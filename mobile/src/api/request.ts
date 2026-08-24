import type { AxiosRequestConfig } from 'axios';

import { apiClient } from './axios';
import { createApiError } from './errors';
import type { ApiSuccessResponse } from './types';

function isSuccessEnvelope<T>(
  payload: ApiSuccessResponse<T> | T,
): payload is ApiSuccessResponse<T> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    (payload as ApiSuccessResponse<T>).success === true &&
    'data' in payload
  );
}

function unwrapResponseData<T>(payload: ApiSuccessResponse<T>): T {
  if (isSuccessEnvelope<T>(payload)) {
    return payload.data;
  }

  throw createApiError({
    code: 'UNEXPECTED_RESPONSE',
    status: null,
    message: 'Unexpected server response',
  });
}

/**
 * Typed request helpers. All methods unwrap `{ success, data }` envelopes
 * and reject with `ApiError` via Axios interceptors.
 */
export async function get<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.get<ApiSuccessResponse<T>>(url, config);
  return unwrapResponseData(response.data);
}

export async function post<T, TBody = Record<string, never>>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.post<ApiSuccessResponse<T>>(url, body, config);
  return unwrapResponseData(response.data);
}

export async function patch<T, TBody = Record<string, never>>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.patch<ApiSuccessResponse<T>>(url, body, config);
  return unwrapResponseData(response.data);
}

export async function put<T, TBody = Record<string, never>>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.put<ApiSuccessResponse<T>>(url, body, config);
  return unwrapResponseData(response.data);
}

export async function del<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.delete<ApiSuccessResponse<T>>(url, config);
  return unwrapResponseData(response.data);
}

export const request = {
  get,
  post,
  patch,
  put,
  delete: del,
} as const;

import { createApiError, isApiError } from '@/api/errors';
import { refreshTokens } from '@/api/auth.api';
import type { Tokens } from '@/api/types';
import { useAuthStore } from '@/store/auth';

/**
 * Token refresh is enabled against backend POST /auth/refresh.
 */
export const tokenRefreshConfig = {
  enabled: true,
  path: '/auth/refresh',
} as const;

type QueuedRequest = {
  resolve: (tokens: Tokens) => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let refreshQueue: QueuedRequest[] = [];

function flushQueue(error: unknown, tokens: Tokens | null): void {
  const queue = refreshQueue;
  refreshQueue = [];

  for (const entry of queue) {
    if (error || !tokens) {
      entry.reject(
        error ??
          createApiError({
            code: 'UNAUTHORIZED',
            status: 401,
            message: 'Session expired. Please sign in again.',
          }),
      );
    } else {
      entry.resolve(tokens);
    }
  }
}

function enqueueRefresh(): Promise<Tokens> {
  return new Promise<Tokens>((resolve, reject) => {
    refreshQueue.push({ resolve, reject });
  });
}

/**
 * Single-flight refresh with a pending-request queue.
 * When disabled, fails closed so callers clear the session.
 */
export async function refreshSession(): Promise<Tokens> {
  if (!tokenRefreshConfig.enabled) {
    throw createApiError({
      code: 'UNAUTHORIZED',
      status: 401,
      message: 'Session expired. Please sign in again.',
    });
  }

  if (isRefreshing) {
    return enqueueRefresh();
  }

  isRefreshing = true;
  useAuthStore.getState().setRefreshing(true);

  try {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      throw createApiError({
        code: 'UNAUTHORIZED',
        status: 401,
        message: 'Session expired. Please sign in again.',
      });
    }

    const response = await refreshTokens({ refreshToken });

    const tokens: Tokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    };

    await useAuthStore.getState().persistTokens(tokens);
    flushQueue(null, tokens);
    return tokens;
  } catch (error) {
    flushQueue(error, null);
    throw isApiError(error)
      ? error
      : createApiError({
          code: 'UNAUTHORIZED',
          status: 401,
          message: 'Session expired. Please sign in again.',
        });
  } finally {
    isRefreshing = false;
    useAuthStore.getState().setRefreshing(false);
  }
}

export function isTokenRefreshInFlight(): boolean {
  return isRefreshing;
}

export const tokenRefreshService = {
  refreshSession,
  isTokenRefreshInFlight,
  config: tokenRefreshConfig,
} as const;

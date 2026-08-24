/**
 * Pluggable access-token provider for the Axios request interceptor.
 *
 * Wired during app bootstrap to `useAuthStore.getState().accessToken`
 * so authenticated requests attach Authorization automatically.
 */

export type AccessTokenProvider = () => string | null | Promise<string | null>;

let accessTokenProvider: AccessTokenProvider | null = null;

export function setAccessTokenProvider(provider: AccessTokenProvider | null): void {
  accessTokenProvider = provider;
}

export function clearAccessTokenProvider(): void {
  accessTokenProvider = null;
}

export async function getAccessToken(): Promise<string | null> {
  if (!accessTokenProvider) {
    return null;
  }

  try {
    const token = await accessTokenProvider();
    if (typeof token !== 'string' || token.trim().length === 0) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

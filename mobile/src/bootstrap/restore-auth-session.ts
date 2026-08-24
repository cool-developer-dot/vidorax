/**
 * Bootstrap adapter for session restoration.
 * Implementation lives in `@/services/auth/session.service`.
 */
export async function restoreAuthSession(): Promise<boolean> {
  const { restoreSession } = await import('@/services/auth/session.service');
  return restoreSession();
}

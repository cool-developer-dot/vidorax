import { type PropsWithChildren } from 'react';

/**
 * Session lifecycle is owned by bootstrap (`runAppInitializer`) + auth store.
 * This provider is a stable extension point for future session listeners
 * (foreground refresh, biometric unlock, etc.) without changing route trees.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  return children;
}

import { useCallback, useRef, useState } from 'react';

import type { ForgotPasswordFormValues } from '../validation';

export type ForgotPasswordStatus = 'idle' | 'loading' | 'success';

const SIMULATED_LATENCY_MS = 1000;

/**
 * UI-phase forgot-password flow.
 *
 * Swap `requestPasswordReset` later with:
 *   POST /auth/forgot-password
 * without changing the screen.
 */
async function requestPasswordReset(_values: ForgotPasswordFormValues): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, SIMULATED_LATENCY_MS);
  });
}

export function useForgotPassword() {
  const [status, setStatus] = useState<ForgotPasswordStatus>('idle');
  const inFlight = useRef(false);

  const submit = useCallback(async (values: ForgotPasswordFormValues) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setStatus('loading');

    try {
      await requestPasswordReset({
        email: values.email.trim(),
      });
      setStatus('success');
    } catch {
      // UI phase has no failure path from the network — keep the screen usable.
      setStatus('idle');
    } finally {
      inFlight.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
  }, []);

  return {
    status,
    loading: status === 'loading',
    success: status === 'success',
    submit,
    reset,
  };
}

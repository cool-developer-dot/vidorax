import { useCallback, useRef, useState } from 'react';

import { isApiError } from '@/api/errors';
import { replace } from '@/navigation/helpers/navigation';
import { routePaths } from '@/navigation/constants/route-paths';
import { login as loginSession } from '@/services/auth';
import { useAuthStore } from '@/store';

import { translate } from '@/localization';

import type { LoginFormValues } from '../validation';

export type LoginStatus = 'idle' | 'loading' | 'success';

function mapLoginError(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return translate('auth.incorrectCredentials');
      case 'NETWORK_ERROR':
        return translate('auth.unableToConnect');
      case 'TIMEOUT':
        return translate('auth.requestTimeout');
      case 'VALIDATION_ERROR':
        return error.details[0]?.msg ?? translate('auth.checkDetails');
      case 'SERVER_ERROR':
        return translate('auth.genericFailure');
      default:
        return translate('auth.genericFailure');
    }
  }

  if (error instanceof Error && error.message) {
    return translate('auth.genericFailure');
  }

  return translate('auth.genericFailure');
}

export function useLogin() {
  const remembered = useAuthStore((state) => state.rememberMe);

  const [status, setStatus] = useState<LoginStatus>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const submit = useCallback(
    async (values: LoginFormValues) => {
      if (inFlight.current || status === 'loading') {
        return;
      }

      inFlight.current = true;
      setFormError(null);
      setStatus('loading');

      const email = values.email.trim();
      const { password, rememberMe } = values;

      try {
        await loginSession(
          { email, password },
          { rememberMe },
        );

        setStatus('success');
        replace(routePaths.home);
      } catch (error) {
        setFormError(mapLoginError(error));
        setStatus('idle');
      } finally {
        inFlight.current = false;
      }
    },
    [status],
  );

  const clearFormError = useCallback(() => {
    setFormError(null);
  }, []);

  return {
    status,
    loading: status === 'loading',
    formError,
    clearFormError,
    submit,
    defaultRememberMe: remembered,
  };
}

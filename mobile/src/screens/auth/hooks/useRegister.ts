import { useCallback, useRef, useState } from 'react';

import { isApiError } from '@/api/errors';
import { replace } from '@/navigation/helpers/navigation';
import { routePaths } from '@/navigation/constants/route-paths';
import { register as registerSession } from '@/services/auth';

import { translate } from '@/localization';

import { normalizeFullName, type RegisterFormValues } from '../validation';

export type RegisterStatus = 'idle' | 'loading' | 'success';

export type RegisterFormError = {
  message: string;
  code?: 'CONFLICT' | 'NETWORK' | 'TIMEOUT' | 'SERVER' | 'VALIDATION' | 'UNKNOWN';
};

function mapRegisterError(error: unknown): RegisterFormError {
  if (isApiError(error)) {
    switch (error.code) {
      case 'CONFLICT':
        return { message: translate('auth.duplicateEmail'), code: 'CONFLICT' };
      case 'NETWORK_ERROR':
        return {
          message: translate('auth.unableToConnect'),
          code: 'NETWORK',
        };
      case 'TIMEOUT':
        return {
          message: translate('auth.requestTimeout'),
          code: 'TIMEOUT',
        };
      case 'VALIDATION_ERROR':
        return {
          message: error.details[0]?.msg ?? translate('auth.checkDetails'),
          code: 'VALIDATION',
        };
      case 'SERVER_ERROR':
        return {
          message: translate('auth.genericFailure'),
          code: 'SERVER',
        };
      default:
        return {
          message: translate('auth.genericFailure'),
          code: 'UNKNOWN',
        };
    }
  }

  return {
    message: translate('auth.genericFailure'),
    code: 'UNKNOWN',
  };
}

export function useRegister() {
  const [status, setStatus] = useState<RegisterStatus>('idle');
  const [formError, setFormError] = useState<RegisterFormError | null>(null);
  const inFlight = useRef(false);

  const submit = useCallback(
    async (values: RegisterFormValues) => {
      if (inFlight.current || status === 'loading') {
        return;
      }

      inFlight.current = true;
      setFormError(null);
      setStatus('loading');

      const name = normalizeFullName(values.name);
      const email = values.email.trim();
      const { password } = values;

      try {
        await registerSession({ name, email, password });

        setStatus('success');
        replace(routePaths.home);
      } catch (error) {
        setFormError(mapRegisterError(error));
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
  };
}

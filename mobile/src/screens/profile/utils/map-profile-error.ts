import { isApiError } from '@/api/errors';
import { translate } from '@/localization';

export type ProfileErrorKind =
  | 'network'
  | 'server'
  | 'unauthorized'
  | 'unexpected';

export type ProfileErrorViewModel = {
  kind: ProfileErrorKind;
  title: string;
  message: string;
};

/**
 * Maps API / unknown errors into user-facing profile error copy.
 * Unauthorized is surfaced so the screen can reuse the auth logout flow.
 */
export function mapProfileError(error: unknown): ProfileErrorViewModel {
  if (isApiError(error)) {
    if (error.isUnauthorized) {
      return {
        kind: 'unauthorized',
        title: translate('errors.unauthorizedTitle'),
        message: translate('errors.unauthorized'),
      };
    }

    if (error.isForbidden) {
      return {
        kind: 'unexpected',
        title: translate('errors.forbiddenTitle'),
        message: translate('errors.forbidden'),
      };
    }

    if (error.isNetworkError) {
      return {
        kind: 'network',
        title: translate('errors.networkTitle'),
        message: translate('errors.network'),
      };
    }

    if (error.code === 'SERVER_ERROR' || (error.status !== null && error.status >= 500)) {
      return {
        kind: 'server',
        title: translate('errors.serverTitle'),
        message: translate('errors.server'),
      };
    }
  }

  return {
    kind: 'unexpected',
    title: translate('errors.unexpectedTitle'),
    message: translate('errors.unexpected'),
  };
}

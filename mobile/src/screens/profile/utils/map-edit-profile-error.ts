import { isApiError } from '@/api/errors';
import { translate } from '@/localization/translate';

export type EditProfileErrorKind =
  | 'validation'
  | 'network'
  | 'server'
  | 'unauthorized'
  | 'unexpected';

export type EditProfileErrorViewModel = {
  kind: EditProfileErrorKind;
  title: string;
  message: string;
  /** Field-level messages when the API returns validation details. */
  fieldErrors: Partial<Record<'name', string>>;
};

/**
 * Maps API errors for the Edit Profile save flow.
 * Unauthorized is surfaced so the screen can reuse the session logout path.
 */
export function mapEditProfileError(error: unknown): EditProfileErrorViewModel {
  if (isApiError(error)) {
    if (error.isUnauthorized) {
      return {
        kind: 'unauthorized',
        title: translate('errors.unauthorizedTitle'),
        message: translate('errors.unauthorized'),
        fieldErrors: {},
      };
    }

    if (error.isForbidden) {
      return {
        kind: 'unexpected',
        title: translate('errors.forbiddenTitle'),
        message: translate('errors.forbidden'),
        fieldErrors: {},
      };
    }

    if (error.isValidationError) {
      const fieldErrors: EditProfileErrorViewModel['fieldErrors'] = {};

      for (const detail of error.details) {
        if (detail.path === 'name') {
          fieldErrors.name = detail.msg;
        }
      }

      return {
        kind: 'validation',
        title: translate('errors.validationTitle'),
        message: translate('errors.validation'),
        fieldErrors,
      };
    }

    if (error.isNetworkError) {
      return {
        kind: 'network',
        title: translate('errors.networkTitle'),
        message: translate('errors.network'),
        fieldErrors: {},
      };
    }

    if (error.code === 'SERVER_ERROR' || (error.status !== null && error.status >= 500)) {
      return {
        kind: 'server',
        title: translate('errors.serverTitle'),
        message: translate('errors.server'),
        fieldErrors: {},
      };
    }
  }

  return {
    kind: 'unexpected',
    title: translate('errors.unexpectedTitle'),
    message: translate('errors.unexpected'),
    fieldErrors: {},
  };
}

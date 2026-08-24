import { isApiError } from '@/api/errors';

export type AvatarErrorKind =
  | 'permission'
  | 'network'
  | 'server'
  | 'unauthorized'
  | 'too-large'
  | 'unavailable'
  | 'unexpected';

export type AvatarErrorViewModel = {
  kind: AvatarErrorKind;
  title: string;
  message: string;
  /** Whether retrying the same photo can plausibly succeed. */
  retryable: boolean;
};

export function createPermissionError(
  source: 'camera' | 'library',
  canAskAgain: boolean,
): AvatarErrorViewModel {
  const subject = source === 'camera' ? 'camera' : 'photo library';

  return {
    kind: 'permission',
    title: `${source === 'camera' ? 'Camera' : 'Photos'} access needed`,
    message: canAskAgain
      ? `Allow VidoraX to use your ${subject} to set a profile photo.`
      : `Enable ${subject} access for VidoraX in Settings to set a profile photo.`,
    retryable: canAskAgain,
  };
}

/**
 * Maps upload/remove failures to user-facing copy. Storage misconfiguration
 * (503) is called out separately so it is not mistaken for a network blip.
 */
export function mapAvatarError(error: unknown): AvatarErrorViewModel {
  if (isApiError(error)) {
    if (error.isUnauthorized) {
      return {
        kind: 'unauthorized',
        title: 'Session expired',
        message: 'Please sign in again to change your profile photo.',
        retryable: false,
      };
    }

    if (error.isForbidden) {
      return {
        kind: 'unexpected',
        title: 'Upload not allowed',
        message: 'You do not have permission to change this profile photo.',
        retryable: false,
      };
    }

    if (error.status === 413) {
      return {
        kind: 'too-large',
        title: 'Photo too large',
        message: 'That photo is too large to upload. Try a different one.',
        retryable: false,
      };
    }

    if (error.isNetworkError) {
      return {
        kind: 'network',
        title: 'Connection problem',
        message:
          'We could not reach VidoraX. Check your internet connection and try again.',
        retryable: true,
      };
    }

    if (error.status === 503) {
      return {
        kind: 'unavailable',
        title: 'Photo uploads unavailable',
        message:
          'Profile photo storage is not available right now. Please try again later.',
        retryable: true,
      };
    }

    if (error.code === 'SERVER_ERROR' || (error.status !== null && error.status >= 500)) {
      return {
        kind: 'server',
        title: 'Upload failed',
        message:
          'Our servers are having trouble right now. Please try again in a moment.',
        retryable: true,
      };
    }
  }

  return {
    kind: 'unexpected',
    title: 'Upload failed',
    message: 'We could not update your profile photo. Please try again.',
    retryable: true,
  };
}

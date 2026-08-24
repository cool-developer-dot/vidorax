import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { logout } from '@/navigation';
import { isAbortError } from '@/services/avatar';
import {
  compressAvatarImage,
  consumePendingAvatarImage,
  discardTempFile,
  openSystemSettings,
  pickAvatarImage,
  type CompressedImage,
  type ImageSource,
  type PickedImage,
} from '@/services/media';
import { selectAuthUser, useAuthStore } from '@/store/auth';

import {
  createPermissionError,
  mapAvatarError,
  type AvatarErrorViewModel,
} from '../utils/map-avatar-error';
import { markProfileCacheFresh } from '../utils/profile-cache';

export type AvatarUploadStatus =
  | 'idle'
  | 'selecting'
  | 'compressing'
  | 'uploading'
  | 'removing';

export type UseAvatarUploadResult = {
  status: AvatarUploadStatus;
  isBusy: boolean;
  /** Overall upload completion, 0–1. */
  progress: number;
  /** Local file shown optimistically until the remote image is cached. */
  previewUri: string | null;
  error: AvatarErrorViewModel | null;
  hasAvatar: boolean;
  canCancel: boolean;
  canRetry: boolean;
  selectFromCamera: () => Promise<void>;
  selectFromLibrary: () => Promise<void>;
  removePhoto: () => Promise<void>;
  cancel: () => void;
  retry: () => Promise<void>;
  dismissError: () => void;
  openSettings: () => Promise<void>;
};

/**
 * Owns the full avatar lifecycle: pick → compress → signed upload → persist.
 *
 * The compressed file is retained after a failure so `retry` re-uploads the
 * same bytes instead of forcing the user back through the picker.
 */
export function useAvatarUpload(): UseAvatarUploadResult {
  const user = useAuthStore(selectAuthUser);
  const uploadAvatar = useAuthStore((state) => state.uploadAvatar);
  const removeAvatar = useAuthStore((state) => state.removeAvatar);

  const [status, setStatus] = useState<AvatarUploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState<AvatarErrorViewModel | null>(null);
  const [hasPendingUpload, setHasPendingUpload] = useState(false);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const pendingUploadRef = useRef<CompressedImage | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const releasePendingUpload = useCallback(() => {
    const pending = pendingUploadRef.current;
    pendingUploadRef.current = null;

    if (pending) {
      discardTempFile(pending.uri);
    }

    if (mountedRef.current) {
      setHasPendingUpload(false);
    }
  }, []);

  const resetToIdle = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    setStatus('idle');
    setProgress(0);
  }, []);

  const handleFailure = useCallback((caught: unknown) => {
    const mapped = mapAvatarError(caught);

    if (mapped.kind === 'unauthorized') {
      logout();
      return;
    }

    if (mountedRef.current) {
      setError(mapped);
    }
  }, []);

  const runUpload = useCallback(
    async (image: CompressedImage) => {
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('uploading');
      setProgress(0);
      setError(null);

      try {
        const profile = await uploadAvatar({
          fileUri: image.uri,
          byteSize: image.byteSize,
          signal: controller.signal,
          onProgress: ({ ratio }) => {
            if (mountedRef.current) {
              setProgress(ratio);
            }
          },
        });

        markProfileCacheFresh();

        // Warm the CDN image before dropping the local preview so the avatar
        // never flashes back to initials during the swap.
        if (profile.avatarUrl) {
          await Image.prefetch(profile.avatarUrl).catch(() => undefined);
        }

        releasePendingUpload();

        if (mountedRef.current) {
          setPreviewUri(null);
          setProgress(1);
        }
      } catch (caught) {
        if (isAbortError(caught)) {
          releasePendingUpload();
          if (mountedRef.current) {
            setPreviewUri(null);
          }
          return;
        }

        handleFailure(caught);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        resetToIdle();
      }
    },
    [handleFailure, releasePendingUpload, resetToIdle, uploadAvatar],
  );

  const compressAndUpload = useCallback(
    async (picked: PickedImage) => {
      let compressed: CompressedImage;

      if (mountedRef.current) {
        setStatus('compressing');
      }

      try {
        compressed = await compressAvatarImage(picked);
      } catch (caught) {
        handleFailure(caught);
        resetToIdle();
        return;
      }

      // Replace any previous attempt's temp file before tracking the new one.
      releasePendingUpload();
      pendingUploadRef.current = compressed;

      if (!mountedRef.current) {
        releasePendingUpload();
        return;
      }

      setHasPendingUpload(true);
      setPreviewUri(compressed.uri);
      await runUpload(compressed);
    },
    [handleFailure, releasePendingUpload, resetToIdle, runUpload],
  );

  const selectImage = useCallback(
    async (source: ImageSource) => {
      if (status !== 'idle') {
        return;
      }

      setError(null);
      setStatus('selecting');

      let picked: Awaited<ReturnType<typeof pickAvatarImage>>;

      try {
        picked = await pickAvatarImage(source);
      } catch (caught) {
        handleFailure(caught);
        resetToIdle();
        return;
      }

      if (picked.status === 'canceled') {
        resetToIdle();
        return;
      }

      if (picked.status === 'permission-denied') {
        if (mountedRef.current) {
          setError(createPermissionError(picked.source, picked.canAskAgain));
        }
        resetToIdle();
        return;
      }

      await compressAndUpload(picked.image);
    },
    [compressAndUpload, handleFailure, resetToIdle, status],
  );

  // Android may kill the activity while the camera is open. Reclaim that photo
  // on the next launch instead of losing it.
  const recoveryStartedRef = useRef(false);

  useEffect(() => {
    if (recoveryStartedRef.current) {
      return;
    }
    recoveryStartedRef.current = true;

    void (async () => {
      const recovered = await consumePendingAvatarImage();

      if (recovered && mountedRef.current) {
        await compressAndUpload(recovered);
      }
    })();
  }, [compressAndUpload]);

  const selectFromCamera = useCallback(
    () => selectImage('camera'),
    [selectImage],
  );

  const selectFromLibrary = useCallback(
    () => selectImage('library'),
    [selectImage],
  );

  const removePhoto = useCallback(async () => {
    if (status !== 'idle') {
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setStatus('removing');

    try {
      await removeAvatar(controller.signal);
      markProfileCacheFresh();
      releasePendingUpload();

      if (mountedRef.current) {
        setPreviewUri(null);
      }
    } catch (caught) {
      if (!isAbortError(caught)) {
        handleFailure(caught);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      resetToIdle();
    }
  }, [
    handleFailure,
    releasePendingUpload,
    removeAvatar,
    resetToIdle,
    status,
  ]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(async () => {
    const pending = pendingUploadRef.current;

    if (!pending || status !== 'idle') {
      return;
    }

    await runUpload(pending);
  }, [runUpload, status]);

  const dismissError = useCallback(() => {
    setError(null);
    releasePendingUpload();
    setPreviewUri(null);
  }, [releasePendingUpload]);

  const openSettings = useCallback(async () => {
    await openSystemSettings();
  }, []);

  return {
    status,
    isBusy: status !== 'idle',
    progress,
    previewUri,
    error,
    hasAvatar: Boolean(user?.avatarUrl),
    canCancel: status === 'uploading',
    canRetry: hasPendingUpload && status === 'idle',
    selectFromCamera,
    selectFromLibrary,
    removePhoto,
    cancel,
    retry,
    dismissError,
    openSettings,
  };
}

import { zodResolver } from '@hookform/resolvers/zod';
import { isCancel } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { Profile, UpdateProfileRequest } from '@/api/types';
import { timeouts } from '@/constants/timeouts';
import { logout } from '@/navigation';
import { selectAuthUser, useAuthStore } from '@/store/auth';

import {
  createEditProfileDefaultValues,
  editProfileSchema,
  normalizeEditProfileValues,
  type EditProfileFormValues,
} from '../validation/edit-profile.schema';
import {
  mapEditProfileError,
  type EditProfileErrorViewModel,
} from '../utils/map-edit-profile-error';
import { markProfileCacheFresh } from '../utils/profile-cache';

export type UseEditProfileResult = {
  form: ReturnType<typeof useForm<EditProfileFormValues>>;
  user: Profile | null;
  isSaving: boolean;
  canSave: boolean;
  formError: EditProfileErrorViewModel | null;
  successVisible: boolean;
  onSubmit: () => void;
  onRetry: () => void;
  dismissSuccess: () => void;
  resetToServer: () => void;
};

function buildUpdatePayload(
  current: Profile,
  values: EditProfileFormValues,
): UpdateProfileRequest | null {
  const normalized = normalizeEditProfileValues(values);
  const payload: UpdateProfileRequest = {};

  if (normalized.name !== current.name) {
    payload.name = normalized.name;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

/**
 * Edit Profile controller — React Hook Form + Zod + authStore.updateProfile.
 * Single source of truth remains authStore.user after a successful PATCH.
 * Avatar mutations use the dedicated upload/remove pipeline only.
 */
export function useEditProfile(): UseEditProfileResult {
  const user = useAuthStore(selectAuthUser);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<EditProfileErrorViewModel | null>(
    null,
  );
  const [successVisible, setSuccessVisible] = useState(false);

  const mountedRef = useRef(true);
  const saveGenerationRef = useRef(0);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seededUserIdRef = useRef<string | null>(null);

  const defaults = useMemo(
    () =>
      createEditProfileDefaultValues({
        name: user?.name ?? '',
      }),
    [user?.name],
  );

  const form = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: defaults,
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const {
    formState: { isDirty, isValid },
    reset,
    handleSubmit,
    setError,
    clearErrors,
  } = form;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      // Bump generation so any in-flight save ignores setState after unmount.
      saveGenerationRef.current += 1;
    };
  }, []);

  // Seed form once per user identity. Do not clobber dirty edits on background sync.
  useEffect(() => {
    if (!user) {
      seededUserIdRef.current = null;
      return;
    }

    if (seededUserIdRef.current === user.id) {
      return;
    }

    seededUserIdRef.current = user.id;
    reset(
      createEditProfileDefaultValues({
        name: user.name,
      }),
    );
  }, [reset, user]);

  const dismissSuccess = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setSuccessVisible(false);
  }, []);

  const showSuccess = useCallback(() => {
    setSuccessVisible(true);
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setSuccessVisible(false);
      }
      successTimerRef.current = null;
    }, timeouts.toast);
  }, []);

  const resetToServer = useCallback(() => {
    if (!user) {
      return;
    }
    dismissSuccess();
    setFormError(null);
    clearErrors();
    reset(
      createEditProfileDefaultValues({
        name: user.name,
      }),
    );
  }, [clearErrors, dismissSuccess, reset, user]);

  const save = useCallback(
    async (values: EditProfileFormValues) => {
      if (!user || isSaving) {
        return;
      }

      const payload = buildUpdatePayload(user, values);
      if (!payload) {
        return;
      }

      const generation = ++saveGenerationRef.current;
      setIsSaving(true);
      setFormError(null);
      dismissSuccess();

      try {
        const profile = await updateProfile(payload);

        if (!mountedRef.current || generation !== saveGenerationRef.current) {
          return;
        }

        markProfileCacheFresh();
        reset(
          createEditProfileDefaultValues({
            name: profile.name,
          }),
        );
        showSuccess();
      } catch (caught) {
        if (isCancel(caught)) {
          return;
        }

        if (!mountedRef.current || generation !== saveGenerationRef.current) {
          return;
        }

        const mapped = mapEditProfileError(caught);

        if (mapped.kind === 'unauthorized') {
          logout();
          return;
        }

        if (mapped.kind === 'validation') {
          if (mapped.fieldErrors.name) {
            setError('name', { type: 'server', message: mapped.fieldErrors.name });
          }
        }

        setFormError(mapped);
      } finally {
        if (mountedRef.current && generation === saveGenerationRef.current) {
          setIsSaving(false);
        }
      }
    },
    [dismissSuccess, isSaving, reset, setError, showSuccess, updateProfile, user],
  );

  const onSubmit = useCallback(() => {
    void handleSubmit((values) => {
      void save(values);
    })();
  }, [handleSubmit, save]);

  const onRetry = useCallback(() => {
    void handleSubmit((values) => {
      void save(values);
    })();
  }, [handleSubmit, save]);

  const canSave = Boolean(user) && isDirty && isValid && !isSaving;

  return {
    form,
    user,
    isSaving,
    canSave,
    formError,
    successVisible,
    onSubmit,
    onRetry,
    dismissSuccess,
    resetToServer,
  };
}

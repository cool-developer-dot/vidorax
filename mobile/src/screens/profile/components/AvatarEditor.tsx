import { memo, useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/base/Icon';
import { Pressable } from '@/components/base/Pressable';
import { Text } from '@/components/base/Text';
import { ActionSheetModal } from '@/components/bottom-sheets';
import type { ActionSheetItem } from '@/components/bottom-sheets';
import { TextButton } from '@/components/buttons/TextButton';
import { Loader } from '@/components/common/Loader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ConfirmModal } from '@/components/modals/ConfirmModal';

import { useTranslation } from '@/localization';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { useProfileTokens } from '../theme/profile-tokens';
import { ProfileAvatar } from './ProfileAvatar';

export type AvatarEditorProps = {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  testID?: string;
};

const BADGE_SIZE = 34;

/**
 * Tappable avatar with the full photo lifecycle attached: pick, upload with
 * progress and cancellation, retry, and remove. Self-contained so any screen
 * can drop it in and stay in sync with `authStore`.
 */
export const AvatarEditor = memo(function AvatarEditor({
  name,
  avatarUrl,
  size = 104,
  testID = 'avatar-editor',
}: AvatarEditorProps) {
  const profileTokens = useProfileTokens();
  const { t } = useTranslation();
  const {
    status,
    isBusy,
    progress,
    previewUri,
    error,
    hasAvatar,
    canCancel,
    canRetry,
    selectFromCamera,
    selectFromLibrary,
    removePhoto,
    cancel,
    retry,
    dismissError,
    openSettings,
  } = useAvatarUpload();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [confirmRemoveVisible, setConfirmRemoveVisible] = useState(false);

  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);

  const requestRemove = useCallback(() => setConfirmRemoveVisible(true), []);
  const cancelRemove = useCallback(() => setConfirmRemoveVisible(false), []);

  const confirmRemove = useCallback(() => {
    setConfirmRemoveVisible(false);
    void removePhoto();
  }, [removePhoto]);

  const actions = useMemo<ActionSheetItem[]>(() => {
    const items: ActionSheetItem[] = [
      {
        id: 'camera',
        label: t('profile.takePhoto'),
        icon: 'camera-outline',
        onPress: () => {
          void selectFromCamera();
        },
      },
      {
        id: 'library',
        label: t('profile.chooseFromLibrary'),
        icon: 'image-outline',
        onPress: () => {
          void selectFromLibrary();
        },
      },
    ];

    if (hasAvatar) {
      items.push({
        id: 'remove',
        label: t('profile.removePhoto'),
        icon: 'trash-can-outline',
        destructive: true,
        onPress: requestRemove,
      });
    }

    return items;
  }, [hasAvatar, requestRemove, selectFromCamera, selectFromLibrary, t]);

  const displayedSource = previewUri ?? avatarUrl ?? null;
  const isUploading = status === 'uploading';
  const percent = Math.round(Math.max(0, Math.min(progress, 1)) * 100);

  const statusLabel = (() => {
    switch (status) {
      case 'selecting':
        return t('profile.opening');
      case 'compressing':
        return t('profile.optimizing');
      case 'uploading':
        return `${t('profile.uploading')} ${percent}%`;
      case 'removing':
        return t('profile.removing');
      default:
        return null;
    }
  })();

  const ring = 4;
  const outer = size + ring * 2;

  return (
    <View style={{ alignItems: 'center', gap: 12 }} testID={testID}>
      <View style={{ width: outer, height: outer }}>
        <Pressable
          onPress={openSheet}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={
            hasAvatar ? t('profile.a11yChange') : t('profile.a11yAdd')
          }
          accessibilityHint={t('profile.a11yHint')}
          accessibilityState={{ disabled: isBusy, busy: isBusy }}
          testID={`${testID}-trigger`}>
          {/* The avatar is its own a11y element; hiding it keeps the button focusable. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <ProfileAvatar
              name={name}
              source={displayedSource}
              size={size}
              testID={`${testID}-avatar`}
            />
          </View>

          {isBusy ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: ring,
                left: ring,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: 'rgba(2, 6, 23, 0.55)',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}>
              {isUploading ? (
                <Text
                  variant="subtitle"
                  color="white"
                  style={{ letterSpacing: -0.2 }}>
                  {percent}%
                </Text>
              ) : (
                <Loader size="small" color={profileTokens.white} />
              )}
            </View>
          ) : (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 0,
                bottom: 2,
                width: BADGE_SIZE,
                height: BADGE_SIZE,
                borderRadius: BADGE_SIZE / 2,
                backgroundColor: profileTokens.primary,
                borderWidth: 3,
                borderColor: profileTokens.avatarRing,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="camera-outline" size={16} color="inverse" />
            </View>
          )}
        </Pressable>
      </View>

      {statusLabel ? (
        <View
          style={{ width: '100%', maxWidth: 260, gap: 8, alignItems: 'center' }}
          accessibilityLiveRegion="polite">
          <Text
            variant="caption"
            style={{ color: profileTokens.textSecondary }}
            testID={`${testID}-status`}>
            {statusLabel}
          </Text>

          {isUploading ? (
            <ProgressBar
              progress={progress}
              style={{ alignSelf: 'stretch' }}
              testID={`${testID}-progress`}
            />
          ) : null}

          {canCancel ? (
            <TextButton
              title={t('profile.cancelUpload')}
              onPress={cancel}
              accessibilityLabel={t('profile.cancelUpload')}
              testID={`${testID}-cancel-upload`}
            />
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View
          testID={`${testID}-error`}
          accessibilityRole="alert"
          style={{
            alignSelf: 'stretch',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderRadius: profileTokens.radius.card,
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.16)',
            paddingHorizontal: 16,
            paddingVertical: 14,
            gap: 8,
          }}>
          <Text
            variant="subtitle"
            style={{ color: profileTokens.textPrimary, letterSpacing: -0.2 }}>
            {error.title}
          </Text>
          <Text
            variant="caption"
            style={{ color: profileTokens.textSecondary, lineHeight: 18 }}>
            {error.message}
          </Text>

          {error.kind === 'permission' && !error.retryable ? (
            <TextButton
              title={t('profile.openSettings')}
              onPress={() => {
                void openSettings();
              }}
              accessibilityLabel={t('profile.openSettings')}
              testID={`${testID}-open-settings`}
            />
          ) : null}

          {error.retryable && canRetry ? (
            <TextButton
              title={t('profile.retryUpload')}
              onPress={() => {
                void retry();
              }}
              accessibilityLabel={t('profile.retryUpload')}
              testID={`${testID}-retry`}
            />
          ) : (
            <TextButton
              title={t('common.dismiss')}
              onPress={dismissError}
              accessibilityLabel={t('common.dismiss')}
              testID={`${testID}-dismiss-error`}
            />
          )}
        </View>
      ) : null}

      <ActionSheetModal
        visible={sheetVisible}
        onClose={closeSheet}
        title={t('profile.avatarSheetTitle')}
        subtitle={t('profile.avatarSheetSubtitle')}
        actions={actions}
        testID={`${testID}-sheet`}
      />

      <ConfirmModal
        visible={confirmRemoveVisible}
        variant="delete"
        title={t('profile.removeConfirmTitle')}
        message={t('profile.removeConfirmMessage')}
        confirmLabel={t('profile.removePhoto')}
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
        loading={status === 'removing'}
        testID={`${testID}-remove-confirm`}
      />
    </View>
  );
});

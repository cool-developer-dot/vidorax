import { Controller, useWatch } from 'react-hook-form';
import { memo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';

import { Box } from '@/components/base/Box';
import { Text } from '@/components/base/Text';
import { LoadingButton } from '@/components/buttons/LoadingButton';
import { TextButton } from '@/components/buttons/TextButton';
import { EmptyState } from '@/components/common/EmptyState';
import { SafeAreaScreen } from '@/components/common/SafeAreaScreen';
import { TextField } from '@/components/inputs/TextField';
import { useTranslation } from '@/localization';

import {
  AvatarEditor,
  ProfileSection,
  ProfileSuccessBanner,
} from './components';
import { useEditProfile } from './hooks';
import { useProfileTokens } from './theme/profile-tokens';

export const EditProfileScreen = memo(function EditProfileScreen() {
  const profileTokens = useProfileTokens();
  const { t } = useTranslation();
  const {
    form,
    user,
    isSaving,
    canSave,
    formError,
    successVisible,
    onSubmit,
    onRetry,
    resetToServer,
  } = useEditProfile();

  const {
    control,
    formState: { errors, dirtyFields },
  } = form;

  const watchedName = useWatch({ control, name: 'name' });

  if (!user) {
    return (
      <SafeAreaScreen
        testID="edit-profile-screen-empty"
        scrollable
        padded={false}
        edges={['bottom', 'left', 'right']}
        style={{ backgroundColor: profileTokens.background }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: profileTokens.spacing.screenX,
          paddingBottom: 40,
          justifyContent: 'center',
        }}>
        <EmptyState
          icon="account-off-outline"
          title="Profile unavailable"
          description="Load your profile first, then come back to edit your details."
          testID="edit-profile-empty-state"
        />
      </SafeAreaScreen>
    );
  }

  const previewName =
    typeof watchedName === 'string' && watchedName.trim().length > 0
      ? watchedName
      : user.name;

  return (
    <SafeAreaScreen
      testID="edit-profile-screen"
      scrollable
      padded={false}
      edges={['bottom', 'left', 'right']}
      style={{ backgroundColor: profileTokens.background }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: profileTokens.spacing.screenX,
        paddingBottom: 40,
        backgroundColor: profileTokens.background,
      }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View style={{ gap: profileTokens.spacing.sectionGap, paddingTop: 8 }}>
          <ProfileSuccessBanner visible={successVisible} />

          <Box center gap={12} py={8}>
            <AvatarEditor
              name={previewName}
              avatarUrl={user.avatarUrl}
              size={96}
              testID="edit-profile-avatar-editor"
            />
            <Text
              variant="caption"
              style={{
                textAlign: 'center',
                color: profileTokens.textSecondary,
                lineHeight: 18,
                paddingHorizontal: 24,
              }}>
              Tap your photo to take a new one, choose one from your library, or
              remove it.
            </Text>
          </Box>

          <ProfileSection
            title="Personal details"
            description="Keep your public profile accurate and up to date"
            icon="account-edit-outline"
            testID="edit-profile-form-section">
            <View style={{ gap: 16, paddingVertical: 10 }}>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value, ref } }) => (
                  <TextField
                    ref={ref}
                    label="Full Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    autoCorrect={false}
                    textContentType="name"
                    returnKeyType="done"
                    onSubmitEditing={canSave ? onSubmit : undefined}
                    error={errors.name?.message}
                    leftIcon="account-outline"
                    disabled={isSaving}
                    accessibilityLabel={t('profile.fullNameA11y')}
                    accessibilityHint={t('profile.nameLengthHint')}
                    testID="edit-profile-name-field"
                  />
                )}
              />
            </View>
          </ProfileSection>

          {formError ? (
            <View
              testID="edit-profile-form-error"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                borderRadius: profileTokens.radius.card,
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.16)',
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 10,
              }}>
              <Text
                variant="subtitle"
                style={{ color: profileTokens.textPrimary, letterSpacing: -0.2 }}>
                {formError.title}
              </Text>
              <Text
                variant="caption"
                style={{ color: profileTokens.textSecondary, lineHeight: 18 }}>
                {formError.message}
              </Text>
              {formError.kind === 'network' || formError.kind === 'server' ? (
                <TextButton
                  title="Retry"
                  onPress={onRetry}
                  disabled={isSaving}
                  accessibilityLabel={t('profile.retrySaveA11y')}
                  testID="edit-profile-retry-button"
                />
              ) : null}
            </View>
          ) : null}

          <View style={{ gap: 12 }}>
            <LoadingButton
              title="Save changes"
              loading={isSaving}
              disabled={!canSave}
              onPress={onSubmit}
              fullWidth
              accessibilityLabel={
                canSave
                  ? 'Save profile changes'
                  : 'Save disabled until you make valid changes'
              }
              testID="edit-profile-save-button"
            />

            {dirtyFields.name && !isSaving ? (
              <TextButton
                title="Discard changes"
                onPress={resetToServer}
                accessibilityLabel={t('profile.discardChangesA11y')}
                testID="edit-profile-discard-button"
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaScreen>
  );
});

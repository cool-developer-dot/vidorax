/** Minimum interval between automatic background profile syncs (ms). */
export const PROFILE_STALE_MS = 5 * 60 * 1000;

/** Debounce window to ignore rapid pull-to-refresh gestures (ms). */
export const PROFILE_REFRESH_DEBOUNCE_MS = 400;

export const PROFILE_COPY = {
  welcomePrefix: 'Welcome back,',
  accountSection: 'Account Information',
  appSection: 'Application Information',
  actionsSection: 'Quick Actions',
  emptyTitle: 'Profile unavailable',
  emptyDescription:
    'We could not find your account details. Pull to refresh or tap retry to try again.',
  editSuccessTitle: 'Profile updated',
  editSuccessMessage: 'Your changes are saved and synced across VidoraX.',
} as const;

export const AVATAR_COPY = {
  sheetTitle: 'Profile photo',
  sheetSubtitle: 'Choose how you want to update your photo',
  takePhoto: 'Take Photo',
  chooseFromLibrary: 'Choose from Library',
  removePhoto: 'Remove Photo',
  removeConfirmTitle: 'Remove profile photo?',
  removeConfirmMessage:
    'Your photo will be deleted and replaced with your initials.',
  opening: 'Opening…',
  optimizing: 'Optimizing photo…',
  uploading: 'Uploading',
  removing: 'Removing photo…',
  cancelUpload: 'Cancel upload',
  retryUpload: 'Retry upload',
  openSettings: 'Open Settings',
  dismiss: 'Dismiss',
  a11yAdd: 'Add profile photo',
  a11yChange: 'Change profile photo',
  a11yHint: 'Opens options to take a photo, choose one, or remove it.',
} as const;

/** Copy for Settings → Download Settings. */

export const DOWNLOAD_SETTINGS_COPY = {
  screenTitle: 'Download Settings',
  screenSubtitle: 'Control how downloads behave on this device',
  behaviorSection: 'Download behavior',
  behaviorDescription: 'When new downloads start and how they recover',
  performanceSection: 'Performance',
  performanceDescription: 'How many downloads can run at once',
  notificationsSection: 'Notifications',
  notificationsDescription: 'Get notified when downloads finish or fail.',
  wifiOnly: 'Download over Wi-Fi only',
  wifiOnlyHint: 'New downloads wait until Wi-Fi is available.',
  autoResume: 'Automatically resume interrupted downloads',
  autoResumeHint: 'Resume eligible interrupted downloads when safe.',
  maxConcurrent: 'Maximum simultaneous downloads',
  maxConcurrentHint: 'Choose how many downloads can run at once.',
  notifications: 'Download notifications',
  notificationsHint: 'Get notified when downloads finish or fail.',
  notificationsPermissionRequired: 'Notifications permission required',
  notificationsPermissionHint:
    'Allow notifications in Android settings to receive download alerts.',
  openSystemSettings: 'Open Android settings',
  successTitle: 'Preference saved',
  successMessage: 'Your download settings were updated.',
  pendingSyncTitle: 'Saved on this device',
  pendingSyncMessage: 'We will sync this preference when you are back online.',
  preferenceErrorTitle: 'Could not save preference',
} as const;

export const CONCURRENT_SEGMENT_OPTIONS = [
  { value: '1' as const, label: '1', accessibilityLabel: '1 simultaneous download' },
  { value: '2' as const, label: '2', accessibilityLabel: '2 simultaneous downloads' },
  { value: '3' as const, label: '3', accessibilityLabel: '3 simultaneous downloads' },
  { value: '4' as const, label: '4', accessibilityLabel: '4 simultaneous downloads' },
];

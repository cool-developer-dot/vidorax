/** Debounce window to ignore rapid pull-to-refresh gestures (ms). */
export const SETTINGS_REFRESH_DEBOUNCE_MS = 400;

export const SETTINGS_COPY = {
  screenTitle: 'Settings',
  screenSubtitle: 'Preferences sync across your VidoraX account',
  appearanceSection: 'Appearance',
  appearanceDescription: 'Look and feel of the app',
  generalSection: 'General',
  generalDescription: 'Language and regional preferences',
  downloadsSection: 'Downloads',
  downloadsDescription: 'How downloads behave on this device',
  downloadSettings: 'Download Settings',
  downloadSettingsHint: 'Wi-Fi, resume, concurrency, and download alerts',
  notificationsSection: 'Notifications',
  notificationsDescription: 'Alerts and activity updates',
  aboutSection: 'About',
  aboutDescription: 'App information and account',
  emptyTitle: 'Settings unavailable',
  emptyDescription:
    'We could not find your preferences. Pull to refresh or tap retry to try again.',
  signOut: 'Sign Out',
  theme: 'Theme',
  themeHint: 'Light, dark, or match system',
  language: 'Language',
  languageHint: 'Display language for VidoraX',
  languageSheetTitle: 'Choose language',
  languageSheetSubtitle: 'Select a language. The app updates immediately.',
  wifiOnly: 'Wi-Fi Only',
  wifiOnlyHint: 'Download only on Wi-Fi networks',
  autoResume: 'Auto Resume',
  autoResumeHint: 'Resume interrupted downloads automatically',
  downloadDirectory: 'Download Location',
  downloadDirectoryHint: 'App-managed download storage on this device',
  notifications: 'Notifications',
  notificationsHint: 'Receive download and activity alerts',
  aboutApp: 'About VidoraX',
  aboutAppHint: 'Version, legal, and credits',
  support: 'Help & Support',
  supportHint: 'Get help or contact us',
  profile: 'Profile',
  profileHint: 'View and manage your account',
  successTitle: 'Preference saved',
  successMessage: 'Your settings are synced across VidoraX.',
  pendingSyncTitle: 'Saved on this device',
  pendingSyncMessage: 'We will sync this preference when you are back online.',
  preferenceErrorTitle: 'Could not save preference',
} as const;

export const THEME_LABELS = {
  SYSTEM: 'System',
  LIGHT: 'Light',
  DARK: 'Dark',
} as const;

export const THEME_SEGMENT_OPTIONS = [
  { value: 'system' as const, label: 'System', accessibilityLabel: 'System theme' },
  { value: 'light' as const, label: 'Light', accessibilityLabel: 'Light theme' },
  { value: 'dark' as const, label: 'Dark', accessibilityLabel: 'Dark theme' },
];

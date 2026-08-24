import type { SettingsState } from './types';

export const initialSettingsState: SettingsState = {
  downloadDirectory: null,
  wifiOnly: true,
  autoResume: true,
  notifications: true,
  language: 'en',
  maxConcurrentDownloads: 2,
};

export const MMKV_INSTANCE_ID = 'vidorax';

export const mmkvKeys = {
  themeMode: 'vidorax.mmkv.theme.mode',
  language: 'vidorax.mmkv.language',
  wifiOnly: 'vidorax.mmkv.preferences.wifiOnly',
  autoResume: 'vidorax.mmkv.preferences.autoResume',
  notifications: 'vidorax.mmkv.preferences.notifications',
  downloadDirectory: 'vidorax.mmkv.preferences.downloadDirectory',
  maxConcurrentDownloads: 'vidorax.mmkv.preferences.maxConcurrentDownloads',
  /** Versioned envelope for Week 7 download settings (additive). */
  downloadSettings: 'vidorax.mmkv.preferences.downloadSettings.v1',
  /** Bounded terminal notification dedupe map (local only). */
  downloadNotificationEvents: 'vidorax.mmkv.downloads.notificationEvents.v1',
  /** Library grid/list preference (local only). */
  libraryViewMode: 'vidorax.mmkv.library.viewMode.v1',
  firstLaunch: 'vidorax.mmkv.flags.firstLaunch',
  onboardingComplete: 'vidorax.mmkv.flags.onboardingComplete',
  analyticsEnabled: 'vidorax.mmkv.flags.analyticsEnabled',
  hasSeenBrowserTip: 'vidorax.mmkv.flags.hasSeenBrowserTip',
  browserSession: 'vidorax.mmkv.browser.session',
} as const;

export type MmkvKey = (typeof mmkvKeys)[keyof typeof mmkvKeys];

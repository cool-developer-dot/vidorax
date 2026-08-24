import { mmkvKeys } from '@/storage/constants';

import { getMmkvInstance } from './instance';

export function getBooleanFlag(key: string, defaultValue = false): boolean {
  return getMmkvInstance()?.getBoolean(key) ?? defaultValue;
}

export function setBooleanFlag(key: string, value: boolean): void {
  getMmkvInstance()?.set(key, value);
}

export function getFirstLaunch(defaultValue = true): boolean {
  return getBooleanFlag(mmkvKeys.firstLaunch, defaultValue);
}

export function setFirstLaunch(value: boolean): void {
  setBooleanFlag(mmkvKeys.firstLaunch, value);
}

export function getOnboardingComplete(defaultValue = false): boolean {
  return getBooleanFlag(mmkvKeys.onboardingComplete, defaultValue);
}

export function setOnboardingComplete(value: boolean): void {
  setBooleanFlag(mmkvKeys.onboardingComplete, value);
}

export function getAnalyticsEnabled(defaultValue = true): boolean {
  return getBooleanFlag(mmkvKeys.analyticsEnabled, defaultValue);
}

export function setAnalyticsEnabled(value: boolean): void {
  setBooleanFlag(mmkvKeys.analyticsEnabled, value);
}

export function getHasSeenBrowserTip(defaultValue = false): boolean {
  return getBooleanFlag(mmkvKeys.hasSeenBrowserTip, defaultValue);
}

export function setHasSeenBrowserTip(value: boolean): void {
  setBooleanFlag(mmkvKeys.hasSeenBrowserTip, value);
}

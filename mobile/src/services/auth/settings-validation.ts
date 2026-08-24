import type { ThemeMode, UpdateSettingsRequest } from '@/api/types';
import {
  isSupportedLanguage,
  normalizeLanguageCode,
} from '@/constants/languages';
import type { ThemePreference } from '@/store/theme';

const VALID_API_THEMES: ThemeMode[] = ['SYSTEM', 'LIGHT', 'DARK'];
const VALID_THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

export function isValidThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === 'string' &&
    VALID_THEME_PREFERENCES.includes(value as ThemePreference)
  );
}

export function isValidApiTheme(value: unknown): value is ThemeMode {
  return typeof value === 'string' && VALID_API_THEMES.includes(value as ThemeMode);
}

export function themePreferenceToApi(mode: ThemePreference): ThemeMode {
  switch (mode) {
    case 'light':
      return 'LIGHT';
    case 'dark':
      return 'DARK';
    case 'system':
    default:
      return 'SYSTEM';
  }
}

export function apiThemeToPreference(theme: ThemeMode): ThemePreference {
  switch (theme) {
    case 'LIGHT':
      return 'light';
    case 'DARK':
      return 'dark';
    case 'SYSTEM':
    default:
      return 'system';
  }
}

export function validateLanguageOrThrow(language: string): string {
  const normalized = normalizeLanguageCode(language);
  if (!isSupportedLanguage(normalized)) {
    throw new Error(`Unsupported language code: ${language}`);
  }
  return normalized;
}

export function validateThemePreferenceOrThrow(mode: ThemePreference): ThemePreference {
  if (!isValidThemePreference(mode)) {
    throw new Error(`Invalid theme preference: ${String(mode)}`);
  }
  return mode;
}

export function sanitizeUpdatePayload(
  payload: UpdateSettingsRequest,
): UpdateSettingsRequest {
  const next: UpdateSettingsRequest = {};

  if (payload.theme !== undefined) {
    if (!isValidApiTheme(payload.theme)) {
      throw new Error(`Invalid theme: ${String(payload.theme)}`);
    }
    next.theme = payload.theme;
  }

  if (payload.language !== undefined) {
    next.language = validateLanguageOrThrow(payload.language);
  }

  if (payload.notificationsEnabled !== undefined) {
    if (typeof payload.notificationsEnabled !== 'boolean') {
      throw new Error('notificationsEnabled must be a boolean');
    }
    next.notificationsEnabled = payload.notificationsEnabled;
  }

  if (payload.wifiOnlyDownloads !== undefined) {
    if (typeof payload.wifiOnlyDownloads !== 'boolean') {
      throw new Error('wifiOnlyDownloads must be a boolean');
    }
    next.wifiOnlyDownloads = payload.wifiOnlyDownloads;
  }

  if (payload.autoResumeDownloads !== undefined) {
    if (typeof payload.autoResumeDownloads !== 'boolean') {
      throw new Error('autoResumeDownloads must be a boolean');
    }
    next.autoResumeDownloads = payload.autoResumeDownloads;
  }

  if (payload.downloadDirectory !== undefined) {
    const trimmed = payload.downloadDirectory.trim();
    if (!trimmed || trimmed.length > 255) {
      throw new Error('downloadDirectory must be a non-empty string up to 255 characters');
    }
    next.downloadDirectory = trimmed;
  }

  return next;
}

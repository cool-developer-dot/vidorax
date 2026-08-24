import type { UserSettings } from '@prisma/client';
import * as settingsRepository from '../repositories/settings.repository.js';
import type {
  UpdateSettingsInput,
  UserSettingsResponse,
} from '../types/user.types.js';
import { AppError } from '../utils/errors/index.js';

const toSettingsResponse = (
  settings: UserSettings,
): UserSettingsResponse => ({
  theme: settings.theme,
  language: settings.language,
  notificationsEnabled: settings.notificationsEnabled,
  wifiOnlyDownloads: settings.wifiOnlyDownloads,
  autoResumeDownloads: settings.autoResumeDownloads,
  downloadDirectory: settings.downloadDirectory,
});

const getOrCreateSettings = async (
  userId: string,
): Promise<UserSettings> => {
  const existing = await settingsRepository.findByUserId(userId);

  if (existing) {
    return existing;
  }

  return settingsRepository.createDefault(userId);
};

export const getSettings = async (
  userId: string,
): Promise<UserSettingsResponse> => {
  const settings = await getOrCreateSettings(userId);
  return toSettingsResponse(settings);
};

export const updateSettings = async (
  userId: string,
  input: UpdateSettingsInput,
): Promise<UserSettingsResponse> => {
  await getOrCreateSettings(userId);

  const data: UpdateSettingsInput = {};

  if (input.theme !== undefined) {
    data.theme = input.theme;
  }

  if (input.language !== undefined) {
    data.language = input.language.trim().toLowerCase();
  }

  if (input.notificationsEnabled !== undefined) {
    data.notificationsEnabled = input.notificationsEnabled;
  }

  if (input.wifiOnlyDownloads !== undefined) {
    data.wifiOnlyDownloads = input.wifiOnlyDownloads;
  }

  if (input.autoResumeDownloads !== undefined) {
    data.autoResumeDownloads = input.autoResumeDownloads;
  }

  if (input.downloadDirectory !== undefined) {
    data.downloadDirectory = input.downloadDirectory.trim();
  }

  if (Object.keys(data).length === 0) {
    const settings = await settingsRepository.findByUserId(userId);

    if (!settings) {
      throw new AppError('Settings not found', 404);
    }

    return toSettingsResponse(settings);
  }

  const settings = await settingsRepository.updateByUserId(userId, data);
  return toSettingsResponse(settings);
};

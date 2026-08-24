import { get, patch } from './request';
import type {
  Settings,
  SettingsResponse,
  UpdateSettingsRequest,
} from './types';

export async function getSettings(): Promise<Settings> {
  const response = await get<SettingsResponse>('/settings');
  return response.settings;
}

export async function updateSettings(
  payload: UpdateSettingsRequest,
): Promise<Settings> {
  const response = await patch<SettingsResponse, UpdateSettingsRequest>(
    '/settings',
    payload,
  );
  return response.settings;
}

export const settingsApi = {
  getSettings,
  updateSettings,
} as const;

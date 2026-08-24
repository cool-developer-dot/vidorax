import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import * as settingsService from '../services/settings.service.js';
import { success, unauthorized } from '../utils/response/index.js';
import { handleServiceError } from '../utils/handle-service-error.js';

export const getSettings = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const settings = await settingsService.getSettings(req.user.sub);
    success(res, { settings });
  } catch (error) {
    handleServiceError(error, res);
  }
};

export const updateSettings = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const settings = await settingsService.updateSettings(req.user.sub, {
      theme: req.body.theme,
      language: req.body.language,
      notificationsEnabled: req.body.notificationsEnabled,
      wifiOnlyDownloads: req.body.wifiOnlyDownloads,
      autoResumeDownloads: req.body.autoResumeDownloads,
      downloadDirectory: req.body.downloadDirectory,
    });

    success(res, { settings });
  } catch (error) {
    handleServiceError(error, res);
  }
};

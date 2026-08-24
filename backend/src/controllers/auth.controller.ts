import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import {
  created,
  notFound,
  serverError,
  success,
  unauthorized,
} from '../utils/response/index.js';
import * as authService from '../services/auth.service.js';

export const login = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.login(req.body);
    success(res, result);
  } catch (error) {
    handleAuthError(error, res);
  }
};

export const register = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.register(req.body);
    created(res, result);
  } catch (error) {
    handleAuthError(error, res);
  }
};

export const refresh = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.refresh(req.body);
    success(res, result);
  } catch (error) {
    handleAuthError(error, res);
  }
};

export const logout = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.logout();
    success(res, result);
  } catch (error) {
    handleAuthError(error, res);
  }
};

export const me = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const user = await authService.me(req.user.sub);
    success(res, { user });
  } catch (error) {
    handleAuthError(error, res);
  }
};

const handleAuthError = (
  error: unknown,
  res: Response,
): void => {
  if (error instanceof authService.AuthServiceError) {
    switch (error.statusCode) {
      case 401:
        unauthorized(res, error.message);
        return;
      case 404:
        notFound(res, error.message);
        return;
      default:
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
        return;
    }
  }

  serverError(res);
};

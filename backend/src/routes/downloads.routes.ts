import { Router } from 'express';
import {
  analyzeDownload,
  createDownload,
  deleteDownload,
  getDownload,
  listDownloads,
  updateDownload,
} from '../controllers/download.controller.js';
import { authenticate } from '../middlewares/auth/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  analyzeDownloadValidator,
  createDownloadValidator,
  downloadIdValidator,
  listDownloadsValidator,
  updateDownloadValidator,
} from '../validators/downloads/index.js';

const router = Router();

// Static paths must be registered before `/:id`.
router.post(
  '/analyze',
  authenticate,
  analyzeDownloadValidator,
  validate,
  analyzeDownload,
);
router.post(
  '/',
  authenticate,
  createDownloadValidator,
  validate,
  createDownload,
);
router.get(
  '/',
  authenticate,
  listDownloadsValidator,
  validate,
  listDownloads,
);
router.get(
  '/:id',
  authenticate,
  downloadIdValidator,
  validate,
  getDownload,
);
router.patch(
  '/:id',
  authenticate,
  updateDownloadValidator,
  validate,
  updateDownload,
);
router.delete(
  '/:id',
  authenticate,
  downloadIdValidator,
  validate,
  deleteDownload,
);

export default router;

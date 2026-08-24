import { Router } from 'express';
import {
  clearHistory,
  createHistory,
  deleteHistory,
  getRecentUrls,
  listHistory,
} from '../controllers/browser-history.controller.js';
import { authenticate } from '../middlewares/auth/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createHistoryValidator,
  deleteHistoryValidator,
  listHistoryValidator,
  recentHistoryValidator,
} from '../validators/history/index.js';

const router = Router();

router.get(
  '/',
  authenticate,
  listHistoryValidator,
  validate,
  listHistory,
);
router.post(
  '/',
  authenticate,
  createHistoryValidator,
  validate,
  createHistory,
);
router.get(
  '/recent',
  authenticate,
  recentHistoryValidator,
  validate,
  getRecentUrls,
);
router.delete('/', authenticate, clearHistory);
router.delete(
  '/:id',
  authenticate,
  deleteHistoryValidator,
  validate,
  deleteHistory,
);

export default router;

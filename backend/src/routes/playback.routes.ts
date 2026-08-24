import { Router } from 'express';
import {
  deletePlayback,
  getPlayback,
  listContinueWatching,
  listHistory,
  listRecent,
  updateProgress,
} from '../controllers/playback.controller.js';
import { authenticate } from '../middlewares/auth/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  deletePlaybackValidator,
  getPlaybackValidator,
  listContinueWatchingValidator,
  listPlaybackHistoryValidator,
  listRecentValidator,
  updateProgressValidator,
} from '../validators/playback/index.js';

const router = Router();

// Static collection routes before :mediaId.
router.get(
  '/history',
  authenticate,
  listPlaybackHistoryValidator,
  validate,
  listHistory,
);

router.get(
  '/recent',
  authenticate,
  listRecentValidator,
  validate,
  listRecent,
);

router.get(
  '/continue-watching',
  authenticate,
  listContinueWatchingValidator,
  validate,
  listContinueWatching,
);

router.get(
  '/:mediaId',
  authenticate,
  getPlaybackValidator,
  validate,
  getPlayback,
);

router.put(
  '/:mediaId/progress',
  authenticate,
  updateProgressValidator,
  validate,
  updateProgress,
);

router.delete(
  '/:mediaId',
  authenticate,
  deletePlaybackValidator,
  validate,
  deletePlayback,
);

export default router;

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import bookmarksRoutes from './bookmarks.routes.js';
import downloadsRoutes from './downloads.routes.js';
import favoritesRoutes from './favorites.routes.js';
import healthRoutes from './health.routes.js';
import historyRoutes from './history.routes.js';
import mediaRoutes from './media.routes.js';
import playbackRoutes from './playback.routes.js';
import settingsRoutes from './settings.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/settings', settingsRoutes);
router.use('/history', historyRoutes);
router.use('/bookmarks', bookmarksRoutes);
router.use('/downloads', downloadsRoutes);
router.use('/media', mediaRoutes);
router.use('/playback', playbackRoutes);
router.use('/favorites', favoritesRoutes);

export default router;

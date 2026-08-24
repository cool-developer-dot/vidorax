import { Router } from 'express';
import {
  clearBookmarks,
  createBookmark,
  deleteBookmark,
  listBookmarks,
  updateBookmark,
} from '../controllers/bookmark.controller.js';
import { authenticate } from '../middlewares/auth/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createBookmarkValidator,
  deleteBookmarkValidator,
  listBookmarksValidator,
  updateBookmarkValidator,
} from '../validators/bookmarks/index.js';

const router = Router();

router.get(
  '/',
  authenticate,
  listBookmarksValidator,
  validate,
  listBookmarks,
);
router.post(
  '/',
  authenticate,
  createBookmarkValidator,
  validate,
  createBookmark,
);
router.patch(
  '/:id',
  authenticate,
  updateBookmarkValidator,
  validate,
  updateBookmark,
);
router.delete('/', authenticate, clearBookmarks);
router.delete(
  '/:id',
  authenticate,
  deleteBookmarkValidator,
  validate,
  deleteBookmark,
);

export default router;

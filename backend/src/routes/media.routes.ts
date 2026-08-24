import { Router } from 'express';
import {
  getMediaLibraryItem,
  listMediaLibrary,
} from '../controllers/media-library.controller.js';
import { listMediaFolders, createMediaFolder, patchMediaFolder, deleteMediaFolder } from '../controllers/media-folder.controller.js';
import {
  patchMediaFavorite,
  patchMediaFolder as patchMediaItemFolder,
} from '../controllers/media-organization.controller.js';
import { deleteMedia, renameMedia } from '../controllers/media-metadata.controller.js';
import { authenticate } from '../middlewares/auth/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  listMediaLibraryValidator,
  mediaIdValidator,
  createMediaFolderValidator,
  deleteMediaFolderValidator,
  renameMediaFolderValidator,
  patchMediaFavoriteValidator,
  patchMediaFolderValidator,
  renameMediaValidator,
  deleteMediaValidator,
} from '../validators/media/index.js';

const router = Router();

router.get(
  '/library',
  authenticate,
  listMediaLibraryValidator,
  validate,
  listMediaLibrary,
);

// Logical folder CRUD.
router.get('/folders', authenticate, listMediaFolders);
router.post(
  '/folders',
  authenticate,
  createMediaFolderValidator,
  validate,
  createMediaFolder,
);
router.patch(
  '/folders/:id',
  authenticate,
  renameMediaFolderValidator,
  validate,
  patchMediaFolder,
);
router.delete(
  '/folders/:id',
  authenticate,
  deleteMediaFolderValidator,
  validate,
  deleteMediaFolder,
);

// Media metadata-only patches.
router.patch(
  '/:id/favorite',
  authenticate,
  patchMediaFavoriteValidator,
  validate,
  patchMediaFavorite,
);
router.patch(
  '/:id/folder',
  authenticate,
  patchMediaFolderValidator,
  validate,
  patchMediaItemFolder,
);

router.patch(
  '/:id/rename',
  authenticate,
  renameMediaValidator,
  validate,
  renameMedia,
);

router.delete(
  '/:id',
  authenticate,
  deleteMediaValidator,
  validate,
  deleteMedia,
);

router.get(
  '/:id',
  authenticate,
  mediaIdValidator,
  validate,
  getMediaLibraryItem,
);

export default router;

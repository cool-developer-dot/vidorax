import { Router } from 'express';
import {
  createFavorite,
  deleteFavorite,
  listFavorites,
} from '../controllers/favorite.controller.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { authenticate } from '../middlewares/auth/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createFavoriteValidator,
  deleteFavoriteValidator,
  listFavoritesValidator,
} from '../validators/favorites/index.js';

const router = Router();

router.get(
  '/',
  authenticate,
  listFavoritesValidator,
  validate,
  asyncHandler(listFavorites),
);
router.post(
  '/',
  authenticate,
  createFavoriteValidator,
  validate,
  asyncHandler(createFavorite),
);
router.delete(
  '/:id',
  authenticate,
  deleteFavoriteValidator,
  validate,
  asyncHandler(deleteFavorite),
);

export default router;

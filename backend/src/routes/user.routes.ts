import { Router } from 'express';
import { getMe, updateMe } from '../controllers/user.controller.js';
import {
  commitAvatar,
  createAvatarUploadUrl,
  deleteAvatar,
} from '../controllers/avatar.controller.js';
import { authenticate } from '../middlewares/auth/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  commitAvatarValidator,
  updateProfileValidator,
} from '../validators/user/index.js';

const router = Router();

router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateProfileValidator, validate, updateMe);

router.post('/me/avatar/upload-url', authenticate, createAvatarUploadUrl);
router.put(
  '/me/avatar',
  authenticate,
  commitAvatarValidator,
  validate,
  commitAvatar,
);
router.delete('/me/avatar', authenticate, deleteAvatar);

export default router;

import { Router } from 'express';
import {
  getSettings,
  updateSettings,
} from '../controllers/settings.controller.js';
import { authenticate } from '../middlewares/auth/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateSettingsValidator } from '../validators/settings/index.js';

const router = Router();

router.get('/', authenticate, getSettings);
router.patch(
  '/',
  authenticate,
  updateSettingsValidator,
  validate,
  updateSettings,
);

export default router;

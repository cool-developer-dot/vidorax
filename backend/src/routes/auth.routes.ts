import { Router } from 'express';
import {
  login,
  logout,
  me,
  refresh,
  register,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  loginValidator,
  refreshValidator,
  registerValidator,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/login', loginValidator, validate, login);
router.post('/register', registerValidator, validate, register);
router.post('/refresh', refreshValidator, validate, refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

export default router;

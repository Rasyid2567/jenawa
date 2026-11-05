
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/authenticate.js';
import * as controller from './auth.controller.js';
import { registerSchema, loginSchema } from './auth.schemas.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan. Coba kembali nanti.'
  }
});

router.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  controller.register
);

router.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  controller.login
);

router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);

export default router;

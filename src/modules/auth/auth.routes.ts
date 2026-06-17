import { Router } from 'express';
import { authController } from './auth.controller';
import { protect } from '../../middleware/auth.middleware';
import { validate } from '../trips/trip.middleware'; // Import your Zod middleware here
import {
  verifyFirebaseTokenSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema
} from './auth.validation';

const router = Router();

// Public routes — no auth required
router.post(
  '/register',
  validate(verifyFirebaseTokenSchema),
  authController.register.bind(authController)
);

router.post(
  '/login',
  validate(verifyFirebaseTokenSchema),
  authController.login.bind(authController)
);

router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  authController.forgotPassword.bind(authController)
);

router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  authController.refreshToken.bind(authController)
);

// Protected routes — require a valid access token
router.use(protect);

router.post(
  '/logout',
  validate(logoutSchema),
  authController.logout.bind(authController)
);

router.get(
  '/profile',
  authController.getProfile.bind(authController)
);

export const authRoutes = router;

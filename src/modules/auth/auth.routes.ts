import { Router } from 'express';
import { authController } from './auth.controller';
import { protect } from './auth.middleware';
import { ValidationMiddleware } from '../../middleware/validation.middleware';
import { strictRateLimiter } from '../../middleware/rateLimiter.middleware';
import {
  verifyFirebaseTokenSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  updateProfileSchema,
  setUpiSchema,
  verifyUpiSchema,
  updateFcmTokenSchema,
} from './auth.validation';

const router = Router();

// ============================================================
// PUBLIC ROUTES — No Authentication Required
// Rate limited strictly to prevent abuse
// ============================================================

router.post(
  '/register',
  strictRateLimiter,
  ValidationMiddleware.validate(verifyFirebaseTokenSchema),
  authController.register.bind(authController)
);

router.post(
  '/login',
  strictRateLimiter,
  ValidationMiddleware.validate(loginSchema),
  authController.login.bind(authController)
);

router.post(
  '/forgot-password',
  strictRateLimiter,
  ValidationMiddleware.validate(forgotPasswordSchema),
  authController.forgotPassword.bind(authController)
);

router.post(
  '/refresh-token',
  ValidationMiddleware.validate(refreshTokenSchema),
  authController.refreshToken.bind(authController)
);

// ============================================================
// PROTECTED ROUTES — Require Valid Access Token
// ============================================================

router.use(protect);

// Logout
router.post(
  '/logout',
  ValidationMiddleware.validate(logoutSchema),
  authController.logout.bind(authController)
);

router.post(
  '/logout-all',
  authController.logoutAll.bind(authController)
);

// Profile
router.get(
  '/me',
  authController.getProfile.bind(authController)
);

router.patch(
  '/me',
  ValidationMiddleware.validate(updateProfileSchema),
  authController.updateProfile.bind(authController)
);

// UPI
router.put(
  '/me/upi',
  ValidationMiddleware.validate(setUpiSchema),
  authController.setUpiId.bind(authController)
);

router.post(
  '/me/upi/verify',
  authController.verifyUpi.bind(authController)
);

// Push Notifications
router.put(
  '/me/fcm-token',
  ValidationMiddleware.validate(updateFcmTokenSchema),
  authController.updateFcmToken.bind(authController)
);

// Account Management
router.delete(
  '/me',
  authController.deleteAccount.bind(authController)
);

export const authRoutes = router;
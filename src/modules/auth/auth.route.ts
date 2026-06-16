import { Router } from 'express';
import { authController } from './auth.controller';
import { protect } from '../../middleware/auth.middleware'; // Assuming you have this middleware

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleAuth);
router.post('/apple', authController.appleAuth);
router.post('/refresh-token', authController.refreshToken);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.post('/logout', protect, authController.logout);
router.post('/change-password', protect, authController.changePassword);
router.get('/profile', protect, authController.getProfile);

export const authRoutes = router;

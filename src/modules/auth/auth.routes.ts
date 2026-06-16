import { Router } from 'express';
import { authController } from './auth.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));

// Protected routes
router.use(protect);
router.post('/logout', authController.logout.bind(authController));
router.get('/profile', authController.getProfile.bind(authController));

export const authRoutes = router;
import { Router } from 'express';
import { AppReleaseController } from './appRelease.controller';
import { protect, AuthMiddleware } from '../auth/auth.middleware';

const router = Router();

// Public: Get latest active release for landing page and apps
router.get('/latest', AppReleaseController.getLatestRelease);

// Admin-only management
router.get('/admin/all', protect, AuthMiddleware.authorize('admin'), AppReleaseController.listAllReleases);
router.post('/admin/publish', protect, AuthMiddleware.authorize('admin'), AppReleaseController.publishRelease);

export default router;

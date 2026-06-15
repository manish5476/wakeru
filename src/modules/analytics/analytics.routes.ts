import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { AuthMiddleware } from '../auth/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

// User analytics
router.get('/user', analyticsController.getUserAnalytics.bind(analyticsController));

// Group analytics
router.get('/group/:groupId', analyticsController.getGroupAnalytics.bind(analyticsController));
router.get('/group/:groupId/predictive', analyticsController.getPredictiveAnalytics.bind(analyticsController));
router.get('/group/:groupId/report', analyticsController.getSpendingReport.bind(analyticsController));

export default router;
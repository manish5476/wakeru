import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { AuthMiddleware } from '../auth/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

// User analytics
router.get('/user', analyticsController.getUserAnalytics.bind(analyticsController));

// Trip analytics
router.get('/trip/:tripId', analyticsController.getTripAnalytics.bind(analyticsController));
router.get('/trip/:tripId/predictive', analyticsController.getPredictiveAnalytics.bind(analyticsController));
router.get('/trip/:tripId/report', analyticsController.getSpendingReport.bind(analyticsController));

export default router;
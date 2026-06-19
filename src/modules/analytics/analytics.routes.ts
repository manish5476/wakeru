import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { protect } from '../../middleware/auth.middleware';
import { validate } from '../trips/trip.middleware';
import { analyticsQuerySchema, yearlySummarySchema, tripAnalyticsParamSchema } from './analytics.validators';

const router = Router();
router.use(protect);

// Dashboard widgets
router.get('/quick-stats', analyticsController.getQuickStats);

// User analytics with filters: ?startDate=&endDate=&groupBy=month&category=food&tripId=&compareWith=previous_period
router.get('/user', validate(analyticsQuerySchema, 'query'), analyticsController.getUserAnalytics);

// Trip analytics: /trip/:tripId?startDate=&endDate=&category=food&stopId=
router.get('/trip/:tripId', validate(tripAnalyticsParamSchema, 'params'), validate(analyticsQuerySchema, 'query'), analyticsController.getTripAnalytics);

// Yearly summary: /yearly/2026
router.get('/yearly/:year', validate(yearlySummarySchema, 'params'), analyticsController.getYearlySummary);

export default router;
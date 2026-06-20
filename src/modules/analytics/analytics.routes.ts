import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { protect } from '../../middleware/auth.middleware';
import { validate } from '../trips/trip.middleware';
import { analyticsQuerySchema, yearlySummarySchema, tripAnalyticsParamSchema } from './analytics.validators';
import { comparisonService } from './comparison.service';

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

// Comparison routes
router.get('/compare/trip/:tripId', protect, async (req, res, next) => {
    try {
        const userId = (req as any).user.userId;
        const data = await comparisonService.compareTripWithPrevious(req.params.tripId, userId);
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
});

router.get('/compare/group/:tripId', protect, async (req, res, next) => {
    try {
        const userId = (req as any).user.userId;
        const data = await comparisonService.compareWithGroup(req.params.tripId, userId);
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
});

router.get('/compare/trends', protect, async (req, res, next) => {
    try {
        const userId = (req as any).user.userId;
        const data = await comparisonService.getSpendingTrends(userId);
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
});
export default router;
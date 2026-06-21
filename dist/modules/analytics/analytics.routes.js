"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("./analytics.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const trip_middleware_1 = require("../trips/trip.middleware");
const analytics_validators_1 = require("./analytics.validators");
const comparison_service_1 = require("./comparison.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
// Dashboard widgets
router.get('/quick-stats', analytics_controller_1.analyticsController.getQuickStats);
// User analytics with filters: ?startDate=&endDate=&groupBy=month&category=food&tripId=&compareWith=previous_period
router.get('/user', (0, trip_middleware_1.validate)(analytics_validators_1.analyticsQuerySchema, 'query'), analytics_controller_1.analyticsController.getUserAnalytics);
// Trip analytics: /trip/:tripId?startDate=&endDate=&category=food&stopId=
router.get('/trip/:tripId', (0, trip_middleware_1.validate)(analytics_validators_1.tripAnalyticsParamSchema, 'params'), (0, trip_middleware_1.validate)(analytics_validators_1.analyticsQuerySchema, 'query'), analytics_controller_1.analyticsController.getTripAnalytics);
// Yearly summary: /yearly/2026
router.get('/yearly/:year', (0, trip_middleware_1.validate)(analytics_validators_1.yearlySummarySchema, 'params'), analytics_controller_1.analyticsController.getYearlySummary);
// Comparison routes
router.get('/compare/trip/:tripId', auth_middleware_1.protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const data = await comparison_service_1.comparisonService.compareTripWithPrevious(req.params.tripId, userId);
        res.status(200).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
});
router.get('/compare/group/:tripId', auth_middleware_1.protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const data = await comparison_service_1.comparisonService.compareWithGroup(req.params.tripId, userId);
        res.status(200).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
});
router.get('/compare/trends', auth_middleware_1.protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const data = await comparison_service_1.comparisonService.getSpendingTrends(userId);
        res.status(200).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map
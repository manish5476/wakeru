"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = void 0;
const analytics_service_1 = require("./analytics.service");
const getUser = (req) => {
    const user = req.user;
    if (!user?.userId)
        throw new Error('Not authenticated');
    return user.userId;
};
exports.analyticsController = {
    async getQuickStats(req, res, next) {
        try {
            const userId = getUser(req);
            const stats = await analytics_service_1.analyticsService.getQuickStats(userId);
            res.status(200).json({ success: true, data: stats });
        }
        catch (err) {
            next(err);
        }
    },
    async getUserAnalytics(req, res, next) {
        try {
            const userId = getUser(req);
            const data = await analytics_service_1.analyticsService.getUserAnalytics(userId, req.query);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async getTripAnalytics(req, res, next) {
        try {
            const userId = getUser(req);
            const { tripId } = req.params;
            const data = await analytics_service_1.analyticsService.getTripAnalytics(tripId, userId, req.query);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async getYearlySummary(req, res, next) {
        try {
            const userId = getUser(req);
            const year = parseInt(req.params.year);
            const data = await analytics_service_1.analyticsService.getYearlySummary(userId, year);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=analytics.controller.js.map
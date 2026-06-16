"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = exports.AnalyticsController = void 0;
const analytics_service_1 = require("./analytics.service");
const AppError_1 = require("../../shared/errors/AppError");
const joi_1 = __importDefault(require("joi"));
const timeframeSchema = joi_1.default.string().valid('week', 'month', 'year').default('month');
class AnalyticsController {
    /**
     * Get user analytics
     */
    async getUserAnalytics(req, res, next) {
        try {
            const timeframe = req.query.timeframe || 'month';
            const { error } = timeframeSchema.validate(timeframe);
            if (error) {
                throw new AppError_1.ValidationError('Invalid timeframe');
            }
            const analytics = await analytics_service_1.analyticsService.getUserAnalytics(req.user.userId, timeframe);
            const response = {
                success: true,
                data: analytics,
                timestamp: new Date().toISOString(),
                message: ''
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get group analytics
     */
    async getGroupAnalytics(req, res, next) {
        try {
            const { groupId } = req.params;
            const timeframe = req.query.timeframe || 'month';
            const analytics = await analytics_service_1.analyticsService.getGroupAnalytics(groupId, req.user.userId, timeframe);
            const response = {
                success: true,
                data: analytics,
                timestamp: new Date().toISOString(),
                message: ''
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get predictive analytics
     */
    async getPredictiveAnalytics(req, res, next) {
        try {
            const { groupId } = req.params;
            const analytics = await analytics_service_1.analyticsService.getPredictiveAnalytics(req.user.userId, groupId);
            const response = {
                success: true,
                data: analytics,
                timestamp: new Date().toISOString(),
                message: ''
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get spending report
     */
    async getSpendingReport(req, res, next) {
        try {
            const { groupId } = req.params;
            const timeframe = req.query.timeframe || 'month';
            // This can generate PDF reports
            const report = await analytics_service_1.analyticsService.getGroupAnalytics(groupId, req.user.userId, timeframe);
            const response = {
                success: true,
                data: {
                    report,
                    exportable: true,
                    formats: ['json', 'csv', 'pdf']
                },
                timestamp: new Date().toISOString(),
                message: ''
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AnalyticsController = AnalyticsController;
exports.analyticsController = new AnalyticsController();
//# sourceMappingURL=analytics.controller.js.map
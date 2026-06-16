"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAnalyticsJob = void 0;
const bull_config_1 = require("../bull.config");
const logger_1 = require("../../../config/logger");
const analyticsQueue = bull_config_1.QueueManager.getQueue('analytics-generation');
analyticsQueue.process(async (job) => {
    const { type, userId, groupId, timeframe } = job.data;
    logger_1.logger.info(`Generating ${type} analytics for user: ${userId}`);
    try {
        // Analytics generation logic
        logger_1.logger.info(`Analytics generated successfully`);
    }
    catch (error) {
        logger_1.logger.error(`Analytics generation failed:`, error);
        throw error;
    }
});
const addAnalyticsJob = async (data) => {
    return analyticsQueue.add(data, {
        priority: 1
    });
};
exports.addAnalyticsJob = addAnalyticsJob;
//# sourceMappingURL=analytics.job.js.map
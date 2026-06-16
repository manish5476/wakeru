"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSettlementJob = void 0;
const bull_config_1 = require("../bull.config");
const logger_1 = require("../../../config/logger");
const settlementQueue = bull_config_1.QueueManager.getQueue('settlement-processing');
settlementQueue.process(async (job) => {
    const { groupId } = job.data;
    logger_1.logger.info(`Processing settlement for group: ${groupId}`);
    try {
        // Settlement logic here
        logger_1.logger.info(`Settlement completed for group: ${groupId}`);
    }
    catch (error) {
        logger_1.logger.error(`Settlement failed for group ${groupId}:`, error);
        throw error;
    }
});
const addSettlementJob = async (groupId) => {
    return settlementQueue.add({ groupId }, {
        jobId: `settlement-${groupId}`,
        priority: 3
    });
};
exports.addSettlementJob = addSettlementJob;
//# sourceMappingURL=settlement.job.js.map
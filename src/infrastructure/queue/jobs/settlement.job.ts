import { QueueManager } from '../bull.config';
import { logger } from '../../../config/logger';

const settlementQueue = QueueManager.getQueue('settlement-processing');

settlementQueue.process(async (job) => {
  const { groupId } = job.data;
  
  logger.info(`Processing settlement for group: ${groupId}`);
  
  try {
    // Settlement logic here
    logger.info(`Settlement completed for group: ${groupId}`);
  } catch (error) {
    logger.error(`Settlement failed for group ${groupId}:`, error);
    throw error;
  }
});

export const addSettlementJob = async (groupId: string) => {
  return settlementQueue.add({ groupId }, {
    jobId: `settlement-${groupId}`,
    priority: 3
  });
};
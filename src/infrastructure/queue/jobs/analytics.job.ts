import { QueueManager } from '../queue/bull.config';
import { logger } from '../../config/logger';

const analyticsQueue = QueueManager.getQueue('analytics-generation');

analyticsQueue.process(async (job) => {
  const { type, userId, groupId, timeframe } = job.data;
  
  logger.info(`Generating ${type} analytics for user: ${userId}`);
  
  try {
    // Analytics generation logic
    logger.info(`Analytics generated successfully`);
  } catch (error) {
    logger.error(`Analytics generation failed:`, error);
    throw error;
  }
});

export const addAnalyticsJob = async (data: any) => {
  return analyticsQueue.add(data, {
    priority: 1
  });
};
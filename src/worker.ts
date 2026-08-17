import { config, validateConfig } from './config';
import { database } from './config/database';
import { redisClient } from './config/redis';
import { initializeFirebase } from './config/firebase';
import { logger } from './config/logger';
import { startReminderCron, stopReminderCron } from './modules/reminders/reminder.cron';
import { cronJobs } from './infrastructure/cron-jobs.service';
import { QueueManager } from './infrastructure/queue/bull.config';
import { ocrProcessor } from './modules/receipt/ocr.processor';

const start = async () => {
  validateConfig();
  await database.connect();
  await redisClient.connect();
  initializeFirebase();
  startReminderCron();
  cronJobs.start();

  // Register Bull queue processors
  const ocrQueue = QueueManager.getQueue('receipt-ocr');
  ocrQueue.process(async (job) => {
    const { receiptId, imagePath } = job.data;
    logger.info(`Processing OCR job ${job.id} for receipt: ${receiptId}`);
    await ocrProcessor.processReceipt(receiptId, imagePath);
  });

  logger.info(`Worker started in ${config.NODE_ENV}`);
};

let stopping = false;
const shutdown = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  logger.info(`${signal} received. Stopping worker...`);
  stopReminderCron();
  cronJobs.stop();
  await QueueManager.closeAll();
  await redisClient.disconnect();
  await database.disconnect();
  process.exit(0);
};

start().catch((error) => { logger.error('Worker startup failed', error); process.exit(1); });
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

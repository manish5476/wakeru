import { QueueManager } from '../queue/bull.config';
import { ocrProcessor } from '../../modules/receipt/ocr.processor';
import { logger } from '../../config/logger';

const ocrQueue = QueueManager.getQueue('ocr-processing');

ocrQueue.process(async (job) => {
  const { receiptId, imagePath } = job.data;
  
  logger.info(`Processing OCR job for receipt: ${receiptId}`);
  
  try {
    await ocrProcessor.processReceipt(receiptId, imagePath);
    logger.info(`OCR job completed for receipt: ${receiptId}`);
  } catch (error) {
    logger.error(`OCR job failed for receipt ${receiptId}:`, error);
    throw error;
  }
});

export const addOCRJob = async (receiptId: string, imagePath: string) => {
  return ocrQueue.add({ receiptId, imagePath }, {
    jobId: `ocr-${receiptId}`,
    priority: 5
  });
};
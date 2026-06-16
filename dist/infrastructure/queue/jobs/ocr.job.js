"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addOCRJob = void 0;
const bull_config_1 = require("../bull.config");
const ocr_processor_1 = require("../../../modules/receipt/ocr.processor");
const logger_1 = require("../../../config/logger");
const ocrQueue = bull_config_1.QueueManager.getQueue('ocr-processing');
ocrQueue.process(async (job) => {
    const { receiptId, imagePath } = job.data;
    logger_1.logger.info(`Processing OCR job for receipt: ${receiptId}`);
    try {
        await ocr_processor_1.ocrProcessor.processReceipt(receiptId, imagePath);
        logger_1.logger.info(`OCR job completed for receipt: ${receiptId}`);
    }
    catch (error) {
        logger_1.logger.error(`OCR job failed for receipt ${receiptId}:`, error);
        throw error;
    }
});
const addOCRJob = async (receiptId, imagePath) => {
    return ocrQueue.add({ receiptId, imagePath }, {
        jobId: `ocr-${receiptId}`,
        priority: 5
    });
};
exports.addOCRJob = addOCRJob;
//# sourceMappingURL=ocr.job.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiptService = exports.ReceiptService = void 0;
const receipt_model_1 = require("./receipt.model");
const ocr_processor_1 = require("./ocr.processor");
const AppError_1 = require("../../shared/errors/AppError");
const logger_1 = require("../../config/logger");
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("../../config");
const mongoose_1 = require("mongoose");
const crypto_1 = __importDefault(require("crypto"));
class ReceiptService {
    /**
     * Upload and process receipt
     */
    async uploadReceipt(userId, file, groupId, expenseId) {
        // Validate file
        this.validateFile(file);
        try {
            // Generate unique filename
            const receiptId = crypto_1.default.randomUUID();
            const filename = `receipt-${receiptId}-${Date.now()}`;
            const uploadDir = path_1.default.join(config_1.config.UPLOAD_DIR, 'receipts');
            await promises_1.default.mkdir(uploadDir, { recursive: true });
            // Save original image
            const originalPath = path_1.default.join(uploadDir, `${filename}.jpg`);
            await (0, sharp_1.default)(file.buffer)
                .jpeg({ quality: 85 })
                .toFile(originalPath);
            // Create thumbnail
            const thumbnailPath = path_1.default.join(uploadDir, `${filename}_thumb.jpg`);
            const metadata = await (0, sharp_1.default)(file.buffer)
                .resize(300, 300, { fit: 'inside' })
                .jpeg({ quality: 60 })
                .toFile(thumbnailPath);
            // Create receipt record
            const receipt = new receipt_model_1.Receipt({
                receiptId,
                userId: new mongoose_1.Types.ObjectId(userId),
                groupId: groupId ? new mongoose_1.Types.ObjectId(groupId) : undefined,
                expenseId: expenseId ? new mongoose_1.Types.ObjectId(expenseId) : undefined,
                image: {
                    originalUrl: `/uploads/receipts/${filename}.jpg`,
                    thumbnailUrl: `/uploads/receipts/${filename}_thumb.jpg`,
                    mimeType: file.mimetype,
                    size: file.size,
                    width: metadata.width,
                    height: metadata.height
                },
                status: 'UPLOADED',
                statusHistory: [{
                        status: 'UPLOADED',
                        timestamp: new Date(),
                        message: 'Receipt uploaded successfully'
                    }],
                metadata: {
                    createdBy: new mongoose_1.Types.ObjectId(userId),
                    isDeleted: false,
                    version: 1
                }
            });
            await receipt.save();
            // Start OCR processing in background
            this.processReceiptAsync(receiptId, originalPath).catch(err => {
                logger_1.logger.error('Background OCR processing failed:', err);
            });
            logger_1.logger.info(`Receipt uploaded: ${receiptId}`);
            return receipt;
        }
        catch (error) {
            logger_1.logger.error('Receipt upload failed:', error);
            throw new AppError_1.BadRequestError('Failed to upload receipt');
        }
    }
    /**
     * Get receipt by ID
     */
    async getReceipt(receiptId, userId) {
        const receipt = await receipt_model_1.Receipt.findOne({ receiptId, 'metadata.isDeleted': false });
        if (!receipt) {
            throw new AppError_1.NotFoundError('Receipt');
        }
        if (receipt.userId.toString() !== userId) {
            throw new AppError_1.ForbiddenError('You do not have access to this receipt');
        }
        return receipt;
    }
    /**
     * Get user's receipts
     */
    async getUserReceipts(userId, options = {}) {
        const { page = 1, limit = 20, status } = options;
        const skip = (page - 1) * limit;
        const query = {
            userId: new mongoose_1.Types.ObjectId(userId),
            'metadata.isDeleted': false
        };
        if (status) {
            query.status = status;
        }
        const [receipts, total] = await Promise.all([
            receipt_model_1.Receipt.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            receipt_model_1.Receipt.countDocuments(query)
        ]);
        return { receipts, total };
    }
    /**
     * Get group receipts
     */
    async getGroupReceipts(groupId, userId, options = {}) {
        const { page = 1, limit = 20 } = options;
        const skip = (page - 1) * limit;
        const query = {
            groupId: new mongoose_1.Types.ObjectId(groupId),
            'metadata.isDeleted': false
        };
        const [receipts, total] = await Promise.all([
            receipt_model_1.Receipt.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            receipt_model_1.Receipt.countDocuments(query)
        ]);
        return { receipts, total };
    }
    /**
     * Update receipt with manual corrections
     */
    async updateReceipt(receiptId, userId, updateData) {
        const receipt = await receipt_model_1.Receipt.findOne({ receiptId, 'metadata.isDeleted': false });
        if (!receipt) {
            throw new AppError_1.NotFoundError('Receipt');
        }
        if (receipt.userId.toString() !== userId) {
            throw new AppError_1.ForbiddenError('You do not have access to this receipt');
        }
        // Update OCR data
        if (updateData.ocrData) {
            receipt.ocrData = {
                ...receipt.ocrData,
                ...updateData.ocrData
            };
        }
        if (updateData.status) {
            receipt.status = updateData.status;
            receipt.statusHistory.push({
                status: updateData.status,
                timestamp: new Date(),
                message: updateData.message || 'Status updated manually'
            });
        }
        receipt.metadata.version += 1;
        await receipt.save();
        return receipt;
    }
    /**
     * Delete receipt
     */
    async deleteReceipt(receiptId, userId) {
        const receipt = await receipt_model_1.Receipt.findOne({ receiptId, 'metadata.isDeleted': false });
        if (!receipt) {
            throw new AppError_1.NotFoundError('Receipt');
        }
        if (receipt.userId.toString() !== userId) {
            throw new AppError_1.ForbiddenError('You do not have access to this receipt');
        }
        receipt.metadata.isDeleted = true;
        await receipt.save();
        // Delete files
        const originalPath = path_1.default.join(config_1.config.UPLOAD_DIR, receipt.image.originalUrl.replace('/uploads/', ''));
        const thumbnailPath = path_1.default.join(config_1.config.UPLOAD_DIR, receipt.image.thumbnailUrl.replace('/uploads/', ''));
        await Promise.all([
            promises_1.default.unlink(originalPath).catch(() => { }),
            promises_1.default.unlink(thumbnailPath).catch(() => { })
        ]);
        logger_1.logger.info(`Receipt deleted: ${receiptId}`);
    }
    /**
     * Reprocess receipt OCR
     */
    async reprocessReceipt(receiptId, userId) {
        const receipt = await receipt_model_1.Receipt.findOne({ receiptId, 'metadata.isDeleted': false });
        if (!receipt) {
            throw new AppError_1.NotFoundError('Receipt');
        }
        if (receipt.userId.toString() !== userId) {
            throw new AppError_1.ForbiddenError('You do not have access to this receipt');
        }
        // Reset OCR data
        receipt.ocrData.processed = false;
        receipt.ocrData.confidence = 0;
        receipt.status = 'PROCESSING';
        receipt.statusHistory.push({
            status: 'PROCESSING',
            timestamp: new Date(),
            message: 'OCR reprocessing started'
        });
        await receipt.save();
        // Start reprocessing
        const imagePath = path_1.default.join(config_1.config.UPLOAD_DIR, receipt.image.originalUrl.replace('/uploads/', ''));
        this.processReceiptAsync(receiptId, imagePath).catch(err => {
            logger_1.logger.error('OCR reprocessing failed:', err);
        });
        return receipt;
    }
    /**
     * Process receipt asynchronously
     */
    async processReceiptAsync(receiptId, imagePath) {
        try {
            await ocr_processor_1.ocrProcessor.processReceipt(receiptId, imagePath);
            logger_1.logger.info(`OCR processing completed for receipt: ${receiptId}`);
        }
        catch (error) {
            logger_1.logger.error(`OCR processing failed for receipt ${receiptId}:`, error);
        }
    }
    /**
     * Validate uploaded file
     */
    validateFile(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (!allowedTypes.includes(file.mimetype)) {
            throw new AppError_1.BadRequestError('Invalid file type. Allowed: JPEG, PNG, HEIC, WebP');
        }
        if (file.size > maxSize) {
            throw new AppError_1.BadRequestError('File too large. Maximum size: 10MB');
        }
    }
    /**
     * Convert receipt to expense
     */
    async convertToExpense(receiptId, userId, groupId) {
        const receipt = await this.getReceipt(receiptId, userId);
        if (receipt.status !== 'COMPLETED' && receipt.status !== 'REVIEWED') {
            throw new AppError_1.BadRequestError('Receipt must be processed before converting to expense');
        }
        if (!receipt.ocrData.extractedItems || receipt.ocrData.extractedItems.length === 0) {
            throw new AppError_1.BadRequestError('No items extracted from receipt');
        }
        // Format items for expense creation
        const lineItems = receipt.ocrData.extractedItems.map((item) => ({
            name: item.name,
            category: item.category,
            basePrice: item.price,
            quantity: item.quantity || 1,
            consumers: [{
                    userId,
                    consumptionPercentage: 100
                }]
        }));
        const expenseData = {
            groupId,
            description: `Receipt from ${receipt.ocrData.merchantName || 'Unknown'}`,
            category: lineItems[0]?.category || 'Other',
            currency: receipt.ocrData.currency || 'INR',
            lineItems,
            paidBy: userId,
            paymentMethod: receipt.ocrData.paymentMethod || 'Cash',
            paymentDate: receipt.ocrData.date || new Date()
        };
        return expenseData;
    }
}
exports.ReceiptService = ReceiptService;
exports.receiptService = new ReceiptService();
//# sourceMappingURL=receipt.service.js.map
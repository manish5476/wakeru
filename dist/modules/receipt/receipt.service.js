"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiptService = exports.ReceiptService = void 0;
const mongoose_1 = require("mongoose");
const receipt_model_1 = require("./receipt.model");
const ocr_processor_1 = require("./ocr.processor");
const AppError_1 = require("../../shared/errors/AppError");
const logger_1 = require("../../config/logger");
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("../../config");
const uuid_1 = require("uuid");
class ReceiptService {
    /**
     * Upload and process a receipt image.
     */
    async uploadReceipt(userId, file, tripId, expenseId) {
        this.validateFile(file);
        try {
            const receiptId = (0, uuid_1.v4)();
            const filename = `receipt-${receiptId}-${Date.now()}`;
            const uploadDir = path_1.default.join(config_1.config.UPLOAD_DIR, 'receipts');
            await promises_1.default.mkdir(uploadDir, { recursive: true });
            // Save original
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
            // Create receipt document
            const receipt = new receipt_model_1.Receipt({
                receiptId,
                userId,
                tripId: tripId ? new mongoose_1.Types.ObjectId(tripId) : undefined,
                expenseId: expenseId ? new mongoose_1.Types.ObjectId(expenseId) : undefined,
                image: {
                    originalUrl: `/uploads/receipts/${filename}.jpg`,
                    thumbnailUrl: `/uploads/receipts/${filename}_thumb.jpg`,
                    mimeType: file.mimetype,
                    size: file.size,
                    width: metadata.width,
                    height: metadata.height,
                },
                status: 'UPLOADED',
                statusHistory: [{
                        status: 'UPLOADED',
                        timestamp: new Date(),
                        message: 'Receipt uploaded successfully',
                    }],
                addedBy: userId,
                isDeleted: false,
            });
            await receipt.save();
            // Process OCR in background
            this.processReceiptAsync(receiptId, originalPath).catch((err) => {
                logger_1.logger.error('Background OCR failed:', err);
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
     * Get receipt by ID.
     */
    async getReceipt(receiptId, userId) {
        const receipt = await receipt_model_1.Receipt.findOne({
            receiptId,
            isDeleted: false,
        }).lean();
        if (!receipt)
            throw new AppError_1.NotFoundError('Receipt');
        if (receipt.userId !== userId) {
            throw new AppError_1.ForbiddenError('You do not have access to this receipt');
        }
        return receipt;
    }
    /**
     * Get user's receipts (paginated).
     */
    async getUserReceipts(userId, options = {}) {
        const { page = 1, limit = 20, status } = options;
        const skip = (page - 1) * limit;
        const query = { userId, isDeleted: false };
        if (status)
            query.status = status;
        const [receipts, total] = await Promise.all([
            receipt_model_1.Receipt.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            receipt_model_1.Receipt.countDocuments(query),
        ]);
        return {
            receipts,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get trip receipts.
     */
    async getTripReceipts(tripId, options = {}) {
        const { page = 1, limit = 20 } = options;
        const skip = (page - 1) * limit;
        const query = {
            tripId: new mongoose_1.Types.ObjectId(tripId),
            isDeleted: false,
        };
        const [receipts, total] = await Promise.all([
            receipt_model_1.Receipt.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            receipt_model_1.Receipt.countDocuments(query),
        ]);
        return {
            receipts,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    }
    /**
     * Update receipt (manual corrections).
     */
    async updateReceipt(receiptId, userId, updateData) {
        const receipt = await receipt_model_1.Receipt.findOne({ receiptId, isDeleted: false });
        if (!receipt)
            throw new AppError_1.NotFoundError('Receipt');
        if (receipt.userId !== userId) {
            throw new AppError_1.ForbiddenError('Access denied');
        }
        if (updateData.ocrData) {
            receipt.ocrData = { ...receipt.ocrData.toObject(), ...updateData.ocrData };
        }
        if (updateData.status) {
            receipt.status = updateData.status;
            receipt.statusHistory.push({
                status: updateData.status,
                timestamp: new Date(),
                message: updateData.message || 'Status updated',
            });
        }
        receipt.markModified('ocrData');
        await receipt.save();
        return receipt;
    }
    /**
     * Soft delete receipt.
     */
    async deleteReceipt(receiptId, userId) {
        const receipt = await receipt_model_1.Receipt.findOne({ receiptId, isDeleted: false });
        if (!receipt)
            throw new AppError_1.NotFoundError('Receipt');
        if (receipt.userId !== userId)
            throw new AppError_1.ForbiddenError('Access denied');
        receipt.isDeleted = true;
        await receipt.save();
        // Clean up files
        const originalPath = path_1.default.join(config_1.config.UPLOAD_DIR, receipt.image.originalUrl.replace('/uploads/', ''));
        const thumbnailPath = path_1.default.join(config_1.config.UPLOAD_DIR, receipt.image.thumbnailUrl.replace('/uploads/', ''));
        await Promise.all([
            promises_1.default.unlink(originalPath).catch(() => { }),
            promises_1.default.unlink(thumbnailPath).catch(() => { }),
        ]);
        logger_1.logger.info(`Receipt deleted: ${receiptId}`);
    }
    /**
     * Reprocess OCR.
     */
    async reprocessReceipt(receiptId, userId) {
        const receipt = await receipt_model_1.Receipt.findOne({ receiptId, isDeleted: false });
        if (!receipt)
            throw new AppError_1.NotFoundError('Receipt');
        if (receipt.userId !== userId)
            throw new AppError_1.ForbiddenError('Access denied');
        receipt.ocrData.processed = false;
        receipt.ocrData.confidence = 0;
        receipt.status = 'PROCESSING';
        receipt.statusHistory.push({
            status: 'PROCESSING',
            timestamp: new Date(),
            message: 'OCR reprocessing started',
        });
        await receipt.save();
        const imagePath = path_1.default.join(config_1.config.UPLOAD_DIR, receipt.image.originalUrl.replace('/uploads/', ''));
        this.processReceiptAsync(receiptId, imagePath).catch((err) => {
            logger_1.logger.error('OCR reprocessing failed:', err);
        });
        return receipt;
    }
    /**
     * Convert receipt data to expense input.
     */
    async convertToExpense(receiptId, userId, tripId) {
        const receipt = await this.getReceipt(receiptId, userId);
        if (receipt.status !== 'COMPLETED' && receipt.status !== 'REVIEWED') {
            throw new AppError_1.BadRequestError('Receipt must be processed before converting');
        }
        if (!receipt.ocrData.extractedItems?.length) {
            throw new AppError_1.BadRequestError('No items extracted from receipt');
        }
        // Return expense-ready data — the frontend/expense service creates the expense
        return {
            tripId,
            title: `Receipt: ${receipt.ocrData.merchantName || 'Unknown'}`,
            category: 'food', // Can be changed by user
            amountLocal: receipt.ocrData.totalAmount || receipt.extractedTotal,
            currency: receipt.ocrData.currency || 'INR',
            date: receipt.ocrData.date || new Date(),
            notes: `Auto-generated from receipt ${receiptId}`,
            extractedItems: receipt.ocrData.extractedItems,
            merchantName: receipt.ocrData.merchantName,
        };
    }
    // ============================================================
    // PRIVATE HELPERS
    // ============================================================
    validateFile(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (!allowedTypes.includes(file.mimetype)) {
            throw new AppError_1.BadRequestError(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, HEIC, WebP`);
        }
        if (file.size > maxSize) {
            throw new AppError_1.BadRequestError('File too large. Maximum size: 10MB');
        }
    }
    async processReceiptAsync(receiptId, imagePath) {
        try {
            await ocr_processor_1.ocrProcessor.processReceipt(receiptId, imagePath);
            logger_1.logger.info(`OCR completed for receipt: ${receiptId}`);
        }
        catch (error) {
            logger_1.logger.error(`OCR failed for receipt ${receiptId}:`, error);
        }
    }
}
exports.ReceiptService = ReceiptService;
exports.receiptService = new ReceiptService();
//# sourceMappingURL=receipt.service.js.map
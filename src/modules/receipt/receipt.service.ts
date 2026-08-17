import { Types } from 'mongoose';
import { Receipt } from './receipt.model';
import { ocrProcessor } from './ocr.processor';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../../config';
import { v4 as uuidv4 } from 'uuid';
import { assertActiveTripMember } from '../trips/trip.middleware';
import { QueueManager } from '../../infrastructure/queue/bull.config';

export class ReceiptService {
  
  /**
   * Upload and process a receipt image.
   */
  async uploadReceipt(
    userId: string,
    file: Express.Multer.File,
    tripId?: string,
    expenseId?: string
  ): Promise<any> {
    this.validateFile(file);
    if (tripId) await assertActiveTripMember(tripId, userId);

    try {
      const receiptId = uuidv4();
      const filename = `receipt-${receiptId}-${Date.now()}`;
      const uploadDir = path.join(config.UPLOAD_DIR, 'receipts');
      await fs.mkdir(uploadDir, { recursive: true });

      const originalPath = path.join(uploadDir, `${filename}.jpg`);
      await sharp(file.buffer)
        .jpeg({ quality: 85 })
        .toFile(originalPath);

      const thumbnailPath = path.join(uploadDir, `${filename}_thumb.jpg`);
      const metadata = await sharp(file.buffer)
        .resize(300, 300, { fit: 'inside' })
        .jpeg({ quality: 60 })
        .toFile(thumbnailPath);

      const receipt = new Receipt({
        receiptId,
        userId,
        tripId: tripId ? new Types.ObjectId(tripId) : undefined,
        expenseId: expenseId ? new Types.ObjectId(expenseId) : undefined,
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

      // Enqueue OCR to Bull queue with fallback to background async processing
      try {
        const ocrQueue = QueueManager.getQueue('receipt-ocr');
        await ocrQueue.add(
          { receiptId, imagePath: originalPath },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          }
        );
      } catch (queueErr) {
        logger.warn('Could not enqueue to Bull queue, falling back to in-process OCR:', queueErr);
        this.processReceiptAsync(receiptId, originalPath).catch((err) => {
          logger.error('Background OCR failed:', err);
        });
      }

      logger.info(`Receipt uploaded: ${receiptId}`);
      return receipt;
    } catch (error) {
      logger.error('Receipt upload failed:', error);
      throw new BadRequestError('Failed to upload receipt');
    }
  }
  async getReceipt(receiptId: string, userId: string): Promise<any> {
    const receipt = await Receipt.findOne({
      receiptId,
      isDeleted: false,
    }).lean();

    if (!receipt) throw new NotFoundError('Receipt');
    if (receipt.userId !== userId) {
      throw new ForbiddenError('You do not have access to this receipt');
    }

    return receipt;
  }

  /**
   * Get user's receipts (paginated).
   */
  async getUserReceipts(
    userId: string,
    options: { page?: number; limit?: number; status?: string } = {}
  ) {
    const { page = 1, limit = 20, status } = options;
    const skip = (page - 1) * limit;

    const query: any = { userId, isDeleted: false };
    if (status) query.status = status;

    const [receipts, total] = await Promise.all([
      Receipt.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Receipt.countDocuments(query),
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
  async getTripReceipts(
    tripId: string,
    userId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    await assertActiveTripMember(tripId, userId);
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query = {
      tripId: new Types.ObjectId(tripId),
      isDeleted: false,
    };

    const [receipts, total] = await Promise.all([
      Receipt.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Receipt.countDocuments(query),
    ]);

    return {
      receipts,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Update receipt (manual corrections).
   */
  async updateReceipt(receiptId: string, userId: string, updateData: any) {
    const receipt = await Receipt.findOne({ receiptId, isDeleted: false });

    if (!receipt) throw new NotFoundError('Receipt');
    if (receipt.userId !== userId) {
      throw new ForbiddenError('Access denied');
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
  async deleteReceipt(receiptId: string, userId: string): Promise<void> {
    const receipt = await Receipt.findOne({ receiptId, isDeleted: false });

    if (!receipt) throw new NotFoundError('Receipt');
    if (receipt.userId !== userId) throw new ForbiddenError('Access denied');

    receipt.isDeleted = true;
    await receipt.save();

    // Clean up files
    const originalPath = path.join(
      config.UPLOAD_DIR,
      receipt.image.originalUrl.replace('/uploads/', '')
    );
    const thumbnailPath = path.join(
      config.UPLOAD_DIR,
      receipt.image.thumbnailUrl.replace('/uploads/', '')
    );

    await Promise.all([
      fs.unlink(originalPath).catch(() => {}),
      fs.unlink(thumbnailPath).catch(() => {}),
    ]);

    logger.info(`Receipt deleted: ${receiptId}`);
  }

  /**
   * Reprocess OCR.
   */
  async reprocessReceipt(receiptId: string, userId: string) {
    const receipt = await Receipt.findOne({ receiptId, isDeleted: false });

    if (!receipt) throw new NotFoundError('Receipt');
    if (receipt.userId !== userId) throw new ForbiddenError('Access denied');

    receipt.ocrData.processed = false;
    receipt.ocrData.confidence = 0;
    receipt.status = 'PROCESSING';
    receipt.statusHistory.push({
      status: 'PROCESSING',
      timestamp: new Date(),
      message: 'OCR reprocessing started',
    });
    await receipt.save();

    const imagePath = path.join(
      config.UPLOAD_DIR,
      receipt.image.originalUrl.replace('/uploads/', '')
    );
    this.processReceiptAsync(receiptId, imagePath).catch((err) => {
      logger.error('OCR reprocessing failed:', err);
    });

    return receipt;
  }

  /**
   * Convert receipt data to expense input.
   */
  async convertToExpense(receiptId: string, userId: string, tripId: string) {
    await assertActiveTripMember(tripId, userId);
    const receipt = await this.getReceipt(receiptId, userId);

    if (receipt.status !== 'COMPLETED' && receipt.status !== 'REVIEWED') {
      throw new BadRequestError('Receipt must be processed before converting');
    }

    if (!receipt.ocrData.extractedItems?.length) {
      throw new BadRequestError('No items extracted from receipt');
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

  private validateFile(file: Express.Multer.File): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestError(
        `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, HEIC, WebP`
      );
    }

    if (file.size > maxSize) {
      throw new BadRequestError('File too large. Maximum size: 10MB');
    }
  }

  private async processReceiptAsync(receiptId: string, imagePath: string): Promise<void> {
    try {
      await ocrProcessor.processReceipt(receiptId, imagePath);
      logger.info(`OCR completed for receipt: ${receiptId}`);
    } catch (error) {
      logger.error(`OCR failed for receipt ${receiptId}:`, error);
    }
  }
}

export const receiptService = new ReceiptService();

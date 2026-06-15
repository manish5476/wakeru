import { Receipt } from './receipt.model';
import { ocrProcessor } from './ocr.processor';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import { redisClient } from '../../config/redis';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../../config';
import { Types } from 'mongoose';
import crypto from 'crypto';

export class ReceiptService {
  /**
   * Upload and process receipt
   */
  async uploadReceipt(
    userId: string,
    file: Express.Multer.File,
    groupId?: string,
    expenseId?: string
  ): Promise<any> {
    // Validate file
    this.validateFile(file);

    try {
      // Generate unique filename
      const receiptId = crypto.randomUUID();
      const filename = `receipt-${receiptId}-${Date.now()}`;
      const uploadDir = path.join(config.UPLOAD_DIR, 'receipts');
      
      await fs.mkdir(uploadDir, { recursive: true });

      // Save original image
      const originalPath = path.join(uploadDir, `${filename}.jpg`);
      await sharp(file.buffer)
        .jpeg({ quality: 85 })
        .toFile(originalPath);

      // Create thumbnail
      const thumbnailPath = path.join(uploadDir, `${filename}_thumb.jpg`);
      const metadata = await sharp(file.buffer)
        .resize(300, 300, { fit: 'inside' })
        .jpeg({ quality: 60 })
        .toFile(thumbnailPath);

      // Create receipt record
      const receipt = new Receipt({
        receiptId,
        userId: new Types.ObjectId(userId),
        groupId: groupId ? new Types.ObjectId(groupId) : undefined,
        expenseId: expenseId ? new Types.ObjectId(expenseId) : undefined,
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
          createdBy: new Types.ObjectId(userId),
          isDeleted: false,
          version: 1
        }
      });

      await receipt.save();

      // Start OCR processing in background
      this.processReceiptAsync(receiptId, originalPath).catch(err => {
        logger.error('Background OCR processing failed:', err);
      });

      logger.info(`Receipt uploaded: ${receiptId}`);
      return receipt;
    } catch (error) {
      logger.error('Receipt upload failed:', error);
      throw new BadRequestError('Failed to upload receipt');
    }
  }

  /**
   * Get receipt by ID
   */
  async getReceipt(receiptId: string, userId: string): Promise<any> {
    const receipt = await Receipt.findOne({ receiptId, 'metadata.isDeleted': false });
    
    if (!receipt) {
      throw new NotFoundError('Receipt');
    }

    if (receipt.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this receipt');
    }

    return receipt;
  }

  /**
   * Get user's receipts
   */
  async getUserReceipts(userId: string, options: { page?: number; limit?: number; status?: string } = {}): Promise<any> {
    const { page = 1, limit = 20, status } = options;
    const skip = (page - 1) * limit;

    const query: any = {
      userId: new Types.ObjectId(userId),
      'metadata.isDeleted': false
    };

    if (status) {
      query.status = status;
    }

    const [receipts, total] = await Promise.all([
      Receipt.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Receipt.countDocuments(query)
    ]);

    return { receipts, total };
  }

  /**
   * Get group receipts
   */
  async getGroupReceipts(groupId: string, userId: string, options: any = {}): Promise<any> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query = {
      groupId: new Types.ObjectId(groupId),
      'metadata.isDeleted': false
    };

    const [receipts, total] = await Promise.all([
      Receipt.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Receipt.countDocuments(query)
    ]);

    return { receipts, total };
  }

  /**
   * Update receipt with manual corrections
   */
  async updateReceipt(receiptId: string, userId: string, updateData: any): Promise<any> {
    const receipt = await Receipt.findOne({ receiptId, 'metadata.isDeleted': false });
    
    if (!receipt) {
      throw new NotFoundError('Receipt');
    }

    if (receipt.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this receipt');
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
  async deleteReceipt(receiptId: string, userId: string): Promise<void> {
    const receipt = await Receipt.findOne({ receiptId, 'metadata.isDeleted': false });
    
    if (!receipt) {
      throw new NotFoundError('Receipt');
    }

    if (receipt.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this receipt');
    }

    receipt.metadata.isDeleted = true;
    await receipt.save();

    // Delete files
    const originalPath = path.join(config.UPLOAD_DIR, receipt.image.originalUrl.replace('/uploads/', ''));
    const thumbnailPath = path.join(config.UPLOAD_DIR, receipt.image.thumbnailUrl.replace('/uploads/', ''));
    
    await Promise.all([
      fs.unlink(originalPath).catch(() => {}),
      fs.unlink(thumbnailPath).catch(() => {})
    ]);

    logger.info(`Receipt deleted: ${receiptId}`);
  }

  /**
   * Reprocess receipt OCR
   */
  async reprocessReceipt(receiptId: string, userId: string): Promise<any> {
    const receipt = await Receipt.findOne({ receiptId, 'metadata.isDeleted': false });
    
    if (!receipt) {
      throw new NotFoundError('Receipt');
    }

    if (receipt.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this receipt');
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
    const imagePath = path.join(config.UPLOAD_DIR, receipt.image.originalUrl.replace('/uploads/', ''));
    this.processReceiptAsync(receiptId, imagePath).catch(err => {
      logger.error('OCR reprocessing failed:', err);
    });

    return receipt;
  }

  /**
   * Process receipt asynchronously
   */
  private async processReceiptAsync(receiptId: string, imagePath: string): Promise<void> {
    try {
      await ocrProcessor.processReceipt(receiptId, imagePath);
      logger.info(`OCR processing completed for receipt: ${receiptId}`);
    } catch (error) {
      logger.error(`OCR processing failed for receipt ${receiptId}:`, error);
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG, HEIC, WebP');
    }

    if (file.size > maxSize) {
      throw new BadRequestError('File too large. Maximum size: 10MB');
    }
  }

  /**
   * Convert receipt to expense
   */
  async convertToExpense(receiptId: string, userId: string, groupId: string): Promise<any> {
    const receipt = await this.getReceipt(receiptId, userId);
    
    if (receipt.status !== 'COMPLETED' && receipt.status !== 'REVIEWED') {
      throw new BadRequestError('Receipt must be processed before converting to expense');
    }

    if (!receipt.ocrData.extractedItems || receipt.ocrData.extractedItems.length === 0) {
      throw new BadRequestError('No items extracted from receipt');
    }

    // Format items for expense creation
    const lineItems = receipt.ocrData.extractedItems.map((item: any) => ({
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

export const receiptService = new ReceiptService();
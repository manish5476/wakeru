import { Response, NextFunction } from 'express';
import { receiptService } from './receipt.service';
import { AppError } from '../../shared/errors/AppError';

// ============================================================
// HELPER
// ============================================================

const getUser = (req: any) => {
  if (!req.user?.firebaseUid) throw new AppError('Not authenticated', 401);
  return req.user.firebaseUid; // ✅ FIXED: Use Firebase UID
};

// ============================================================
// CONTROLLER
// ============================================================

export class ReceiptController {
  
  async uploadReceipt(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      const { tripId, expenseId } = req.body;
      
      const receipt = await receiptService.uploadReceipt(
        userId,
        req.file!,
        tripId,
        expenseId
      );

      res.status(201).json({
        success: true,
        message: 'Receipt uploaded — processing started',
        data: { receipt },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserReceipts(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      const { page, limit, status } = req.query;
      
      const result = await receiptService.getUserReceipts(userId, {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        status: status as string,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getTripReceipts(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tripId } = req.params;
      const { page, limit } = req.query;
      
      const result = await receiptService.getTripReceipts(tripId, {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getReceipt(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      const receipt = await receiptService.getReceipt(req.params.receiptId, userId);

      res.status(200).json({ success: true, data: { receipt } });
    } catch (error) {
      next(error);
    }
  }

  async updateReceipt(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      const receipt = await receiptService.updateReceipt(
        req.params.receiptId,
        userId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Receipt updated',
        data: { receipt },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteReceipt(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      await receiptService.deleteReceipt(req.params.receiptId, userId);

      res.status(200).json({
        success: true,
        message: 'Receipt deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  async reprocessReceipt(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      const result = await receiptService.reprocessReceipt(req.params.receiptId, userId);

      res.status(202).json({
        success: true,
        message: 'OCR reprocessing started',
        data: { receipt: result },
      });
    } catch (error) {
      next(error);
    }
  }

  async convertToExpense(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      const { tripId } = req.body;
      
      const expenseData = await receiptService.convertToExpense(
        req.params.receiptId,
        userId,
        tripId
      );

      res.status(200).json({
        success: true,
        message: 'Receipt data ready for expense creation',
        data: { expenseData },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const receiptController = new ReceiptController();
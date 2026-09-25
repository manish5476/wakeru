import { Response, NextFunction } from 'express';
import { receiptService } from './receipt.service';
import { AppError } from '../../shared/errors/AppError';
import { Trip } from '../trips/trip.model';
import { Expense } from '../expense/expense.model';

// ============================================================
// HELPER
// ============================================================

const getUser = (req: any) => {
  const uid = req.user?.userId || req.user?.firebaseUid || req.user?.id;
  if (!uid) throw new AppError('Not authenticated', 401);
  return uid;
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
      const userId = getUser(req);
      const { tripId } = req.params;
      const { page, limit } = req.query;
      
      const result = await receiptService.getTripReceipts(tripId, userId, {
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

  async validateReceiptExpense(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      const amountMinor = req.body.amountMinor ?? req.body.totalMinor;
      const { tripId, currency, splits, receiptHash } = req.body;

      if (!tripId) {
        throw new AppError('tripId is required', 400);
      }

      const trip = await Trip.findById(tripId);
      if (!trip) {
        throw new AppError('Trip not found', 404);
      }

      if (typeof trip.isMember === 'function' ? !trip.isMember(userId) : !trip.members?.some((m: any) => m.userId === userId)) {
        throw new AppError('User is not a member of this trip', 403);
      }

      if (amountMinor !== undefined && (!Number.isInteger(amountMinor) || amountMinor <= 0)) {
        throw new AppError('amountMinor must be a positive integer', 400);
      }

      if (splits && Array.isArray(splits) && splits.length > 0 && amountMinor !== undefined) {
        const splitSum = splits.reduce((sum: number, s: any) => sum + (s.amountMinor ?? s.amountLocal ?? 0), 0);
        if (splitSum !== amountMinor) {
          throw new AppError(`Split sum (${splitSum}) does not equal total amountMinor (${amountMinor})`, 400);
        }
      }

      let existingExpense: any = null;
      if (receiptHash) {
        existingExpense = await Expense.findOne({
          tripId,
          'receiptMetadata.receiptHash': receiptHash,
          isArchived: false,
        }).select('_id title amountLocal date');
      }

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          duplicateDetected: !!existingExpense,
          existingExpense: existingExpense
            ? {
                id: existingExpense._id,
                title: existingExpense.title,
                amountLocal: existingExpense.amountLocal,
                date: existingExpense.date,
              }
            : null,
          tripCurrency: trip.baseCurrency,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const receiptController = new ReceiptController();

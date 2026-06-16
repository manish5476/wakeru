import { Response, NextFunction } from 'express';
import { receiptService } from './receipt.service';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';

export class ReceiptController {

  async uploadReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const receipt = await receiptService.uploadReceipt(req.user!.userId, req.file!);
      const response: ApiResponse = {
        success: true,
        message: 'Receipt uploaded successfully',
        data: receipt,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getUserReceipts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const receipts = await receiptService.getUserReceipts(req.user!.userId);
      const response: ApiResponse = {
        success: true,
        message: 'Receipts retrieved successfully',
        data: receipts,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const receipt = await receiptService.getReceipt(req.params.receiptId, req.user!.userId);
      const response: ApiResponse = {
        success: true,
        message: 'Receipt retrieved successfully',
        data: receipt,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async updateReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const receipt = await receiptService.updateReceipt(req.params.receiptId, req.user!.userId, req.body);
      const response: ApiResponse = {
        success: true,
        message: 'Receipt updated successfully',
        data: receipt,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async deleteReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await receiptService.deleteReceipt(req.params.receiptId, req.user!.userId);
      const response: ApiResponse = {
        success: true,
        message: 'Receipt deleted successfully',
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async reprocessReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await receiptService.reprocessReceipt(req.params.receiptId, req.user!.userId);
      const response: ApiResponse = {
        success: true,
        message: 'Receipt reprocessing started',
        data: result,
        timestamp: new Date().toISOString()
      };
      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  }

  async convertToExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const expense = await receiptService.convertToExpense(req.params.receiptId, req.user!.userId, req.body.groupId);
      const response: ApiResponse = {
        success: true,
        message: 'Receipt converted to expense successfully',
        data: expense,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const receiptController = new ReceiptController();
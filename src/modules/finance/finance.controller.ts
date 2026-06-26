import { Request, Response, NextFunction } from 'express';
import { FinanceService } from './finance.service';
import { AppError } from '../../shared/errors/AppError';

export class FinanceController {
  
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user?.userId) throw new AppError('Not authenticated', 401);
      
      const month = req.query.month as string || new Date().toISOString().substring(0, 7); // Default to current month YYYY-MM
      
      const dashboard = await FinanceService.getDashboard(user.userId, month);
      res.status(200).json({ success: true, data: dashboard });
    } catch (error) {
      next(error);
    }
  }

  static async addTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user?.userId) throw new AppError('Not authenticated', 401);
      
      const data = req.body;
      const transaction = await FinanceService.addTransaction(user.userId, data);
      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      next(error);
    }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user?.userId) throw new AppError('Not authenticated', 401);
      
      const filters = req.query;
      const transactions = await FinanceService.getTransactions(user.userId, filters);
      res.status(200).json({ success: true, data: { transactions } });
    } catch (error) {
      next(error);
    }
  }

  static async setBudget(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user?.userId) throw new AppError('Not authenticated', 401);
      
      const { month, totalBudget, categoryBudgets } = req.body;
      const budget = await FinanceService.setBudget(user.userId, month, totalBudget, categoryBudgets);
      res.status(200).json({ success: true, data: { budget } });
    } catch (error) {
      next(error);
    }
  }
}

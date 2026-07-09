// finance.controller.ts

import { Request, Response, NextFunction } from 'express';
import { FinanceService } from './finance.service';
import { AppError } from '../../shared/errors/AppError';
import { Budget } from './finance.model';

const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.userId) throw new AppError('Not authenticated', 401);
  return user.userId;
};

export class FinanceController {

  // ============================================================
  // DASHBOARD & ANALYTICS
  // ============================================================

  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const month = req.query.month as string | undefined;
      const includeTripExpenses = req.query.includeTripExpenses !== 'false';
      const dashboard = await FinanceService.getDashboard(userId, month, includeTripExpenses);
      res.status(200).json({ success: true, data: dashboard });
    } catch (error) { next(error); }
  }

  static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const filters = {
        period: req.query.period as any,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };
      const analytics = await FinanceService.getAnalytics(userId, filters);
      res.status(200).json({ success: true, data: analytics });
    } catch (error) { next(error); }
  }

  static async getSpendingTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { months = 6, category } = req.query;
      const trends = await FinanceService.getSpendingTrends(
        userId,
        parseInt(months as string),
        category as string
      );
      res.status(200).json({ success: true, data: trends });
    } catch (error) { next(error); }
  }

  static async syncTripExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const result = await FinanceService.syncTripExpenses(userId);
      res.status(200).json({ success: true, message: 'Trip expenses synced', data: result });
    } catch (error) { next(error); }
  }

  // ============================================================
  // TRANSACTIONS
  // ============================================================

  static async createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const transaction = await FinanceService.createTransaction(userId, req.body);
      res.status(201).json({ success: true, data: transaction });
    } catch (error) { next(error); }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const result = await FinanceService.getTransactions(userId, req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  static async getTransactionById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const transaction = await FinanceService.getTransactionById(userId, req.params.id);
      res.status(200).json({ success: true, data: transaction });
    } catch (error) { next(error); }
  }

  static async updateTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const transaction = await FinanceService.updateTransaction(userId, req.params.id, req.body);
      res.status(200).json({ success: true, data: transaction });
    } catch (error) { next(error); }
  }

  static async deleteTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const permanent = req.query.permanent === 'true';
      const result = await FinanceService.deleteTransaction(userId, req.params.id, permanent);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  static async restoreTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const transaction = await FinanceService.restoreTransaction(userId, req.params.id);
      res.status(200).json({ success: true, data: transaction });
    } catch (error) { next(error); }
  }

  static async bulkDeleteTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { ids } = req.body;
      const result = await FinanceService.bulkDeleteTransactions(userId, ids);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  // ============================================================
  // BUDGET
  // ============================================================

  static async setBudget(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { month, totalBudget, categoryBudgets } = req.body;
      const budget = await FinanceService.setBudget(userId, month, totalBudget, categoryBudgets);
      res.status(200).json({ success: true, data: budget });
    } catch (error) { next(error); }
  }

  static async getBudget(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const month = req.query.month as string || new Date().toISOString().substring(0, 7);
      const budget = await FinanceService.getBudget(userId, month);
      res.status(200).json({ success: true, data: budget });
    } catch (error) { next(error); }
  }

  static async updateBudget(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { id } = req.params;
      const { totalBudget, categoryBudgets } = req.body;

      // Find existing budget
      const existingBudget = await Budget.findOne({ _id: id, userId });
      if (!existingBudget) {
        throw new AppError('Budget not found', 404);
      }

      // Update budget
      const updatedBudget = await FinanceService.updateBudget(
        userId,
        id,
        totalBudget,
        categoryBudgets
      );

      res.status(200).json({ success: true, data: updatedBudget });
    } catch (error) { next(error); }
  }

  static async deleteBudget(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { id } = req.params;

      const result = await FinanceService.deleteBudget(userId, id);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  static async getBudgetCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const categories = await FinanceService.getBudgetCategories(userId);
      res.status(200).json({ success: true, data: categories });
    } catch (error) { next(error); }
  }

  // ============================================================
  // BILLS
  // ============================================================

  static async createBill(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const bill = await FinanceService.createBill(userId, req.body);
      res.status(201).json({ success: true, data: bill });
    } catch (error) { next(error); }
  }

  static async getBills(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const bills = await FinanceService.getBills(userId, req.query as any);
      res.status(200).json({ success: true, data: bills });
    } catch (error) { next(error); }
  }

  static async getBillById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const bill = await FinanceService.getBillById(userId, req.params.id);
      res.status(200).json({ success: true, data: bill });
    } catch (error) { next(error); }
  }

  static async updateBill(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const bill = await FinanceService.updateBill(userId, req.params.id, req.body);
      res.status(200).json({ success: true, data: bill });
    } catch (error) { next(error); }
  }

  static async markBillPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { paidAmount } = req.body;
      const bill = await FinanceService.markBillPaid(userId, req.params.id, paidAmount);
      res.status(200).json({ success: true, data: bill });
    } catch (error) { next(error); }
  }

  static async skipBill(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const result = await FinanceService.skipBill(userId, req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  static async deleteBill(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const result = await FinanceService.deleteBill(userId, req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  // ============================================================
  // GOALS
  // ============================================================

  static async createGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const goal = await FinanceService.createGoal(userId, req.body);
      res.status(201).json({ success: true, data: goal });
    } catch (error) { next(error); }
  }

  static async getGoals(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const goals = await FinanceService.getGoals(userId, req.query as any);
      res.status(200).json({ success: true, data: goals });
    } catch (error) { next(error); }
  }

  static async getGoalById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const goal = await FinanceService.getGoalById(userId, req.params.id);
      res.status(200).json({ success: true, data: goal });
    } catch (error) { next(error); }
  }

  static async updateGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const goal = await FinanceService.updateGoal(userId, req.params.id, req.body);
      res.status(200).json({ success: true, data: goal });
    } catch (error) { next(error); }
  }

  static async contributeToGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { amount } = req.body;
      const goal = await FinanceService.contributeToGoal(userId, req.params.id, amount);
      res.status(200).json({ success: true, data: goal });
    } catch (error) { next(error); }
  }

  static async deleteGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const result = await FinanceService.deleteGoal(userId, req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  // ============================================================
  // DEBT & SETTLEMENT
  // ============================================================

  static async getDebtSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const summary = await FinanceService.getDebtSummary(userId);
      res.status(200).json({ success: true, data: summary });
    } catch (error) { next(error); }
  }

  static async getDebtDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { tripId, status } = req.query;
      const details = await FinanceService.getDebtDetails(
        userId,
        tripId as string,
        status as string
      );
      res.status(200).json({ success: true, data: details });
    } catch (error) { next(error); }
  }

  // ============================================================
  // CATEGORIES & TAGS
  // ============================================================

  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { type } = req.query;
      const categories = await FinanceService.getCategories(userId, type as string);
      res.status(200).json({ success: true, data: categories });
    } catch (error) { next(error); }
  }

  static async getTags(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const tags = await FinanceService.getTags(userId);
      res.status(200).json({ success: true, data: tags });
    } catch (error) { next(error); }
  }

  // ============================================================
  // EXPORT & REPORTING
  // ============================================================

  static async exportTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { startDate, endDate, format = 'csv', type = 'all' } = req.query;
      const exportData = await FinanceService.exportTransactions(
        userId,
        startDate as string,
        endDate as string,
        format as string,
        type as string
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=transactions-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(exportData);
      } else {
        res.status(200).json({ success: true, data: exportData });
      }
    } catch (error) { next(error); }
  }

  static async getMonthlyReport(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const month = req.query.month as string || new Date().toISOString().substring(0, 7);
      const report = await FinanceService.getMonthlyReport(userId, month);
      res.status(200).json({ success: true, data: report });
    } catch (error) { next(error); }
  }

  static async getYearlyReport(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const year = req.query.year as string || new Date().getFullYear().toString();
      const report = await FinanceService.getYearlyReport(userId, year);
      res.status(200).json({ success: true, data: report });
    } catch (error) { next(error); }
  }
}
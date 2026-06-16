import { Request, Response, NextFunction } from 'express';
import { expenseService } from './expense.service';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
import { 
  createExpenseSchema,
  updateExpenseSchema,
  getExpensesQuerySchema
} from './expense.validation';
import { ValidationError } from '../../shared/errors/AppError';

export class ExpenseController {
  /**
   * Create expense
   */
  async createExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = createExpenseSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const expense = await expenseService.createExpense(value, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Expense created successfully',
        data: { expense },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get expense by ID
   */
  async getExpenseById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { expenseId } = req.params;
      const expense = await expenseService.getExpenseById(expenseId, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Expense retrieved successfully',
        data: { expense },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get group expenses
   */
  async getGroupExpenses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.params;
      const { error, value } = getExpensesQuerySchema.validate(req.query);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const result = await expenseService.getGroupExpenses(groupId, req.user!.userId, value);

      const response: ApiResponse = {
        success: true,
        message: 'Group expenses retrieved successfully',
        data: result,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's expenses
   */
  async getUserExpenses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = getExpensesQuerySchema.validate(req.query);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const result = await expenseService.getUserExpenses(req.user!.userId, value);

      const response: ApiResponse = {
        success: true,
        message: 'User expenses retrieved successfully',
        data: result,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update expense
   */
  async updateExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { expenseId } = req.params;
      const { error, value } = updateExpenseSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const expense = await expenseService.updateExpense(expenseId, req.user!.userId, value);

      const response: ApiResponse = {
        success: true,
        message: 'Expense updated successfully',
        data: { expense },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete expense
   */
  async deleteExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { expenseId } = req.params;
      await expenseService.deleteExpense(expenseId, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Expense deleted successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const expenseController = new ExpenseController();
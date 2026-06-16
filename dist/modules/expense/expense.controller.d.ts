import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class ExpenseController {
    /**
     * Create expense
     */
    createExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get expense by ID
     */
    getExpenseById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get group expenses
     */
    getGroupExpenses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user's expenses
     */
    getUserExpenses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update expense
     */
    updateExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Delete expense
     */
    deleteExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const expenseController: ExpenseController;
//# sourceMappingURL=expense.controller.d.ts.map
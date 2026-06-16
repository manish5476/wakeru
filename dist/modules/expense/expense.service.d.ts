import { IExpenseDocument } from './expense.model';
import { CreateExpenseDTO, UpdateExpenseDTO } from '../../shared/types/expense.types';
export declare class ExpenseService {
    /**
     * Create a new expense with proportional splitting
     */
    createExpense(expenseData: CreateExpenseDTO, createdBy: string): Promise<IExpenseDocument>;
    /**
     * Get expense by ID
     */
    getExpenseById(expenseId: string, userId: string): Promise<IExpenseDocument>;
    /**
     * Get expenses for a group
     */
    getGroupExpenses(groupId: string, userId: string, options?: any): Promise<{
        expenses: IExpenseDocument[];
        total: number;
    }>;
    /**
     * Get user's expenses
     */
    getUserExpenses(userId: string, options?: any): Promise<{
        expenses: IExpenseDocument[];
        total: number;
    }>;
    /**
     * Update expense
     */
    updateExpense(expenseId: string, userId: string, updateData: UpdateExpenseDTO): Promise<IExpenseDocument>;
    /**
     * Delete expense (soft delete)
     */
    deleteExpense(expenseId: string, userId: string): Promise<void>;
    /**
     * Update group financial summary
     */
    private updateGroupFinancials;
    /**
     * Update user statistics
     */
    private updateUserStats;
    /**
     * Invalidate related caches
     */
    private invalidateRelatedCaches;
}
export declare const expenseService: ExpenseService;
//# sourceMappingURL=expense.service.d.ts.map
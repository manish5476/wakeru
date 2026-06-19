import { IExpense } from './expense.model';
export declare class ExpenseRepository {
    createExpense(expenseData: Partial<IExpense>): Promise<IExpense>;
    findById(expenseId: string): Promise<IExpense | null>;
    findByIdWithDeleted(expenseId: string): Promise<IExpense | null>;
    findByGroupId(groupId: string, options?: {
        page?: number;
        limit?: number;
        category?: string;
        startDate?: Date;
        endDate?: Date;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        expenses: IExpense[];
        total: number;
    }>;
    findByUserId(userId: string, options?: {
        page?: number;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        expenses: IExpense[];
        total: number;
    }>;
    softDelete(expenseId: string, deletedBy: string): Promise<IExpense | null>;
    updateSettlementStatus(expenseId: string, userId: string, status: 'PENDING' | 'SETTLED' | 'PARTIAL'): Promise<void>;
    getGroupExpenseStats(groupId: string): Promise<any>;
    getCategoryAnalytics(userId: string, groupId: string, startDate: Date, endDate: Date): Promise<any>;
    findByDateRange(startDate: Date, endDate: Date, groupId?: string): Promise<IExpense[]>;
    getTotalExpenseAmountForPeriod(userId: string, startDate: Date, endDate: Date): Promise<number>;
}
export declare const expenseRepository: ExpenseRepository;
//# sourceMappingURL=expense.repository.d.ts.map
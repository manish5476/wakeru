import { IExpenseDocument } from './expense.model';
export declare class ExpenseRepository {
    createExpense(expenseData: Partial<IExpenseDocument>): Promise<IExpenseDocument>;
    findById(expenseId: string): Promise<IExpenseDocument | null>;
    findByIdWithDeleted(expenseId: string): Promise<IExpenseDocument | null>;
    findByGroupId(groupId: string, options?: {
        page?: number;
        limit?: number;
        category?: string;
        startDate?: Date;
        endDate?: Date;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        expenses: IExpenseDocument[];
        total: number;
    }>;
    findByUserId(userId: string, options?: {
        page?: number;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        expenses: IExpenseDocument[];
        total: number;
    }>;
    softDelete(expenseId: string, deletedBy: string): Promise<IExpenseDocument | null>;
    updateSettlementStatus(expenseId: string, userId: string, status: 'PENDING' | 'SETTLED' | 'PARTIAL'): Promise<void>;
    getGroupExpenseStats(groupId: string): Promise<any>;
    getCategoryAnalytics(userId: string, groupId: string, startDate: Date, endDate: Date): Promise<any>;
    findByDateRange(startDate: Date, endDate: Date, groupId?: string): Promise<IExpenseDocument[]>;
    getTotalExpenseAmountForPeriod(userId: string, startDate: Date, endDate: Date): Promise<number>;
}
export declare const expenseRepository: ExpenseRepository;
//# sourceMappingURL=expense.repository.d.ts.map
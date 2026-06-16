import { Types } from 'mongoose';
export interface Debt {
    from: string;
    to: string;
    amount: Types.Decimal128;
    groupId: string;
    expenseId?: string;
}
interface SimplifiedTransaction {
    from: string;
    to: string;
    amount: Types.Decimal128;
    note: string;
    relatedExpenses?: string[];
}
export declare class DebtSimplifier {
    /**
     * Minimize number of transactions using graph algorithm
     * Time Complexity: O(n log n) where n is number of participants
     */
    simplifyDebts(debts: Debt[]): SimplifiedTransaction[];
    /**
     * Detect and remove circular debts
     * Example: A->B $50, B->C $50, C->A $50 can all be cancelled
     */
    private applyCircularOptimization;
    /**
     * Get debt summary for a user
     */
    getDebtSummary(userId: string, debts: Debt[]): {
        owes: Array<{
            to: string;
            amount: number;
            currency: string;
        }>;
        isOwed: Array<{
            from: string;
            amount: number;
            currency: string;
        }>;
        netBalance: number;
    };
}
export declare const debtSimplifier: DebtSimplifier;
export {};
//# sourceMappingURL=debt.simplifier.d.ts.map
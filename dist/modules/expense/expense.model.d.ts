import { Document, Types } from 'mongoose';
export type ExpenseCategory = 'food' | 'stay' | 'transport' | 'activity' | 'shopping' | 'health' | 'other';
export type SplitMethod = 'equal' | 'percentage' | 'exact' | 'shares' | 'personal';
/**
 * Per-member split breakdown.
 * Both amountLocal and amountBase are stored so we never re-compute on read.
 * The exchange rate is locked at expense creation time.
 */
export interface ISplit {
    userId: string;
    displayName: string;
    amountLocal: number;
    amountBase: number;
    percentage?: number;
    shares?: number;
    isPaid: boolean;
    paidAt?: Date;
    paymentId?: Types.ObjectId;
}
/**
 * Expense document — the core transaction record.
 */
export interface IExpense extends Document {
    tripId: Types.ObjectId;
    stopId: Types.ObjectId;
    title: string;
    category: ExpenseCategory;
    notes?: string;
    receiptImages: string[];
    date: Date;
    amountLocal: number;
    amountBase: number;
    localCurrency: string;
    baseCurrency: string;
    exchangeRateUsed: number;
    paidBy: string;
    paidByName: string;
    splitMethod: SplitMethod;
    splits: ISplit[];
    isSettled: boolean;
    addedBy: string;
    editedBy?: string;
    editedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Expense: import("mongoose").Model<IExpense, {}, {}, {}, Document<unknown, {}, IExpense, {}, {}> & IExpense & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=expense.model.d.ts.map
import { Document, Types } from 'mongoose';
export type ExpenseCategory = 'food' | 'stay' | 'transport' | 'activity' | 'shopping' | 'health' | 'other';
export type SplitMethod = 'equal' | 'percentage' | 'exact' | 'shares' | 'personal';
/**
 * ISplit — per-member breakdown of an expense.
 *
 * amountLocal  = their share in the stop's local currency (what they see in stop view)
 * amountBase   = their share in the trip's base currency (used for settlement)
 *
 * Both are stored so we never re-compute on read. The exchange rate is locked
 * at expense creation time — changing the stop rate doesn't touch existing splits.
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
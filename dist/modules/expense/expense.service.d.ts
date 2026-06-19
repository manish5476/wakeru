import { Types } from 'mongoose';
import { IExpense } from './expense.model';
import { CreateExpenseInput, UpdateExpenseInput, ExpenseListQuery, SplitInput } from './expense.validation';
interface MemberInfo {
    userId: string;
    displayName: string;
}
interface ComputedSplit {
    userId: string;
    displayName: string;
    amountLocal: number;
    amountBase: number;
    percentage?: number;
    shares?: number;
    isPaid: boolean;
}
/**
 * Compute per-member splits in BOTH currencies.
 *
 * For 'equal' splits, the remainder from rounding is distributed
 * to the first N members (prevents ₹0.01 gaps).
 *
 * For 'personal' splits, the payer owns the full cost — no debt created,
 * the split is marked as paid immediately.
 */
export declare const computeSplits: (splitInput: SplitInput, amountLocal: number, amountBase: number, exchangeRate: number, paidByUid: string, allTripMembers: MemberInfo[]) => ComputedSplit[];
/**
 * Create an expense inside a trip stop.
 *
 * Flow:
 * 1. Load trip to get stop details (currency, exchange rate, members)
 * 2. Compute amountBase = amountLocal × currentExchangeRate
 * 3. Compute per-member splits in both currencies
 * 4. Save expense document
 * 5. Atomically update trip/stop cached totals via $inc
 */
export declare const createExpense: (input: CreateExpenseInput, adderUid: string, adderDisplayName: string) => Promise<IExpense>;
/**
 * Get expenses for a specific stop (paginated, filterable).
 */
export declare const getStopExpenses: (stopId: string, query: ExpenseListQuery) => Promise<{
    expenses: (import("mongoose").FlattenMaps<IExpense> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
        hasMore: boolean;
    };
}>;
/**
 * Get all expenses across ALL stops for a trip.
 */
export declare const getTripExpenses: (tripId: string, query: ExpenseListQuery) => Promise<{
    expenses: (import("mongoose").FlattenMaps<IExpense> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
        hasMore: boolean;
    };
}>;
/**
 * Get all expenses paid by a specific user across all trips.
 */
export declare const getMyExpenses: (userId: string, query: ExpenseListQuery) => Promise<{
    expenses: (import("mongoose").FlattenMaps<IExpense> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}>;
/**
 * Get a single expense by ID.
 * Validates the requester is a member of the trip.
 */
export declare const getExpenseById: (expenseId: string, requestingUid: string) => Promise<IExpense>;
/**
 * Update an expense.
 *
 * If amount, payer, or split changes:
 * 1. Reverse old cached totals (negative $inc)
 * 2. Recompute splits
 * 3. Apply new cached totals
 *
 * Exchange rate is NOT re-fetched — we keep the rate locked at creation.
 */
export declare const updateExpense: (expenseId: string, input: UpdateExpenseInput, editorUid: string) => Promise<IExpense>;
/**
 * Delete an expense and reverse all cached totals.
 * Only the payer or a trip admin can delete.
 */
export declare const deleteExpense: (expenseId: string, requestingUid: string) => Promise<void>;
/**
 * Mark one member's split as paid (manual or UPI confirmation).
 * Auto-updates isSettled if all splits are now paid.
 */
export declare const markSplitPaid: (expenseId: string, targetUserId: string, paymentId?: string) => Promise<IExpense>;
export {};
//# sourceMappingURL=expense.service.d.ts.map
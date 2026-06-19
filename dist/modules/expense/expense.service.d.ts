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
 * Compute splits for an expense.
 * Returns the full ISplit array ready to embed in the expense document.
 *
 * All amounts are rounded to 2 decimal places.
 * For 'equal' splits, the remainder (from rounding) is distributed to the
 * first N members to avoid total drift (e.g. ₹0.01 gaps).
 */
export declare const computeSplits: (splitInput: SplitInput, amountLocal: number, amountBase: number, exchangeRate: number, paidByUid: string, allTripMembers: MemberInfo[]) => ComputedSplit[];
/**
 * Create an expense inside a trip stop.
 *
 * Flow:
 * 1. Load the trip to get stop details (currency, exchange rate, members)
 * 2. Compute amountBase from amountLocal * currentExchangeRate
 * 3. Compute per-member splits in both currencies
 * 4. Save the expense document
 * 5. Update trip/stop cached totals via $inc (atomic)
 */
export declare const createExpense: (input: CreateExpenseInput, adderUid: string, adderDisplayName: string) => Promise<IExpense>;
/**
 * Get all expenses for a specific stop (paginated).
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
 * Get all expenses across all stops for a trip (unified view).
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
 * Get all expenses paid by the current user across all their trips.
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
 * If amountLocal or paidBy or split changes, we:
 * 1. Reverse the old cached totals ($inc with negative values)
 * 2. Recompute splits
 * 3. Save the updated expense
 * 4. Apply new cached totals
 *
 * Exchange rate is NOT re-fetched — we keep the rate that was active at
 * original creation time (unless you explicitly want to reset it).
 */
export declare const updateExpense: (expenseId: string, input: UpdateExpenseInput, editorUid: string) => Promise<IExpense>;
/**
 * Delete an expense and reverse all cached totals.
 * Only the payer or a trip admin can delete.
 */
export declare const deleteExpense: (expenseId: string, requestingUid: string) => Promise<void>;
/**
 * Mark one member's split as paid (after UPI confirmation or manual confirmation).
 * Updates isSettled on the expense if all splits are now paid.
 */
export declare const markSplitPaid: (expenseId: string, targetUserId: string, paymentId?: string) => Promise<IExpense>;
export {};
//# sourceMappingURL=expense.service.d.ts.map
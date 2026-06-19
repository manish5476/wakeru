import { Request, Response, NextFunction } from 'express';
/**
 * POST /api/v1/expenses
 * Create a new expense.
 * Body must include stopId — the trip is resolved from the stop.
 */
export declare const createExpense: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/expenses/stop/:stopId
 * List expenses for a specific stop (paginated, filterable).
 * Query: page, limit, category, paidBy, isSettled, startDate, endDate, sortBy, sortOrder
 */
export declare const getStopExpenses: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/expenses/trip/:tripId
 * List ALL expenses across all stops for a trip.
 * Used for the unified trip expense view.
 */
export declare const getTripExpenses: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/expenses/mine
 * All expenses paid by the current user across all trips.
 */
export declare const getMyExpenses: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/expenses/:expenseId
 * Get a single expense with full split breakdown.
 */
export declare const getExpense: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * PATCH /api/v1/expenses/:expenseId
 * Update an expense. Recalculates splits & cached totals if amount/split changes.
 */
export declare const updateExpense: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * DELETE /api/v1/expenses/:expenseId
 * Delete expense + reverse all cached totals.
 * Only payer or trip admin can delete.
 */
export declare const deleteExpense: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * PATCH /api/v1/expenses/:expenseId/splits/:userId/pay
 * Mark one member's split as paid (manual confirmation).
 * Used when UPI is done outside the app, or for cash payments.
 */
export declare const markSplitPaid: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=expense.controller.d.ts.map
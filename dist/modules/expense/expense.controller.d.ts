import { Request, Response, NextFunction } from 'express';
/**
 * POST /api/v1/expenses
 * Create a new expense with split computation.
 */
export declare const createExpense: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/expenses/stop/:stopId
 * List expenses for a specific stop.
 */
export declare const getStopExpenses: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/expenses/trip/:tripId
 * List ALL expenses across all stops for a trip.
 */
export declare const getTripExpenses: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/expenses/mine
 * All expenses paid by current user across all trips.
 */
export declare const getMyExpenses: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/expenses/:expenseId
 * Get a single expense with full split breakdown.
 */
export declare const getExpense: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * PATCH /api/v1/expenses/:expenseId
 * Update expense — recalculates splits & cached totals if needed.
 */
export declare const updateExpense: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * DELETE /api/v1/expenses/:expenseId
 * Archive expense + reverse all cached totals.
 */
export declare const archiveExpense: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * POST /api/v1/expenses/:expenseId/unarchive
 * Unarchive expense + restore cached totals.
 */
export declare const unarchiveExpense: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * DELETE /api/v1/expenses/:expenseId/permanent
 * Permanently delete expense.
 */
export declare const deleteExpensePermanent: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * PATCH /api/v1/expenses/:expenseId/splits/:userId/pay
 * Mark one member's split as paid.
 */
export declare const markSplitPaid: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=expense.controller.d.ts.map
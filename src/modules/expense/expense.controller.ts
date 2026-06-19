import { Request, Response, NextFunction } from 'express';
import * as expenseService from './expense.service';
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseListQuery,
} from './expense.validation';
import { AppError } from '../../shared/errors/AppError';

// ============================================================
// HELPERS
// ============================================================

const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.userId) throw new AppError('Not authenticated', 401);
  return {
    uid: user.userId,
    displayName: user.displayName || 'User',
    photoURL: user.photoURL,
  };
};

// ============================================================
// CREATE
// ============================================================

/**
 * POST /api/v1/expenses
 * Create a new expense with split computation.
 */
export const createExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const input = req.body as CreateExpenseInput;

    const expense = await expenseService.createExpense(
      input,
      user.uid,
      user.displayName
    );

    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      data: { expense },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// READ
// ============================================================

/**
 * GET /api/v1/expenses/stop/:stopId
 * List expenses for a specific stop.
 */
export const getStopExpenses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { stopId } = req.params;
    const query = req.query as unknown as ExpenseListQuery;

    const result = await expenseService.getStopExpenses(stopId, query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/expenses/trip/:tripId
 * List ALL expenses across all stops for a trip.
 */
export const getTripExpenses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tripId } = req.params;
    const query = req.query as unknown as ExpenseListQuery;

    const result = await expenseService.getTripExpenses(tripId, query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/expenses/mine
 * All expenses paid by current user across all trips.
 */
export const getMyExpenses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const query = req.query as unknown as ExpenseListQuery;

    const result = await expenseService.getMyExpenses(user.uid, query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/expenses/:expenseId
 * Get a single expense with full split breakdown.
 */
export const getExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId } = req.params;

    const expense = await expenseService.getExpenseById(expenseId, user.uid);

    res.status(200).json({
      success: true,
      data: { expense },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// UPDATE
// ============================================================

/**
 * PATCH /api/v1/expenses/:expenseId
 * Update expense — recalculates splits & cached totals if needed.
 */
export const updateExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId } = req.params;
    const input = req.body as UpdateExpenseInput;

    const updated = await expenseService.updateExpense(
      expenseId,
      input,
      user.uid
    );

    res.status(200).json({
      success: true,
      message: 'Expense updated',
      data: { expense: updated },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DELETE
// ============================================================

/**
 * DELETE /api/v1/expenses/:expenseId
 * Delete expense + reverse all cached totals.
 */
export const deleteExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId } = req.params;

    await expenseService.deleteExpense(expenseId, user.uid);

    res.status(200).json({
      success: true,
      message: 'Expense deleted and totals updated',
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// SETTLEMENT
// ============================================================

/**
 * PATCH /api/v1/expenses/:expenseId/splits/:userId/pay
 * Mark one member's split as paid.
 */
export const markSplitPaid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { expenseId, userId } = req.params;
    const { paymentId } = req.body;

    const expense = await expenseService.markSplitPaid(
      expenseId,
      userId,
      paymentId
    );

    res.status(200).json({
      success: true,
      message: 'Split marked as paid',
      data: {
        expense,
        isFullySettled: expense.isSettled,
      },
    });
  } catch (err) {
    next(err);
  }
};
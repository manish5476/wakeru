import { Request, Response, NextFunction } from 'express';
import { expenseService } from './expense.service';
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
  if (!user?.firebaseUid) throw new AppError('Not authenticated', 401);
  return {
    uid: user.firebaseUid,
    displayName: user.displayName || 'User',
    photoURL: user.photoURL,
  };
};

// ============================================================
// CREATE
// ============================================================

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

export const getStopExpenseSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { stopId } = req.params;

    const result = await expenseService.getStopExpenseSummary(
      stopId,
      user.uid
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

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

export const getExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId } = req.params;

    const expense = await expenseService.getExpenseById(
      expenseId,
      user.uid
    );

    res.status(200).json({
      success: true,
      data: { expense },
    });
  } catch (err) {
    next(err);
  }
};

export const getTripExpenseAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;

    const analytics = await expenseService.getTripExpenseAnalytics(
      tripId,
      user.uid
    );

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// UPDATE
// ============================================================

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
// DELETE / ARCHIVE
// ============================================================

export const archiveExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId } = req.params;

    await expenseService.archiveExpense(expenseId, user.uid);

    res.status(200).json({
      success: true,
      message: 'Expense archived and totals updated',
    });
  } catch (err) {
    next(err);
  }
};

export const unarchiveExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId } = req.params;

    await expenseService.unarchiveExpense(expenseId, user.uid);

    res.status(200).json({
      success: true,
      message: 'Expense unarchived and totals restored',
    });
  } catch (err) {
    next(err);
  }
};

export const deleteExpensePermanent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId } = req.params;

    await expenseService.deleteExpensePermanent(expenseId, user.uid);

    res.status(200).json({
      success: true,
      message: 'Expense deleted permanently',
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// COMMENTS
// ============================================================

export const addComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId } = req.params;
    const { text } = req.body;

    const expense = await expenseService.addComment(
      expenseId,
      text,
      user.uid,
      user.displayName
    );

    res.status(201).json({
      success: true,
      message: 'Comment added',
      data: { expense },
    });
  } catch (err) {
    next(err);
  }
};

export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId, commentId } = req.params;

    const expense = await expenseService.deleteComment(
      expenseId,
      commentId,
      user.uid
    );

    res.status(200).json({
      success: true,
      message: 'Comment deleted',
      data: { expense },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// SETTLEMENT
// ============================================================

export const markSplitPaid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { expenseId, userId } = req.params;
    const { paymentId } = req.body;

    const expense = await expenseService.markSplitPaid(
      expenseId,
      userId,
      user.uid,
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


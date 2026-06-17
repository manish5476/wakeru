import { Request, Response, NextFunction } from 'express';
import * as expenseService from './expense.service';
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseListQuery,
} from './expense.validators';
import { AppError } from '../utils/AppError';

const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.uid) throw new AppError('Not authenticated', 401);
  return user as { uid: string; displayName: string; photoURL?: string };
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/expenses
 * Create a new expense.
 * Body must include stopId — the trip is resolved from the stop.
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

/**
 * GET /api/v1/expenses/stop/:stopId
 * List expenses for a specific stop (paginated, filterable).
 * Query: page, limit, category, paidBy, isSettled, startDate, endDate, sortBy, sortOrder
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
 * Used for the unified trip expense view.
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
 * All expenses paid by the current user across all trips.
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

/**
 * PATCH /api/v1/expenses/:expenseId
 * Update an expense. Recalculates splits & cached totals if amount/split changes.
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

/**
 * DELETE /api/v1/expenses/:expenseId
 * Delete expense + reverse all cached totals.
 * Only payer or trip admin can delete.
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

/**
 * PATCH /api/v1/expenses/:expenseId/splits/:userId/pay
 * Mark one member's split as paid (manual confirmation).
 * Used when UPI is done outside the app, or for cash payments.
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
};// import { Request, Response, NextFunction } from 'express';
// import { expenseService } from './expense.service';
// import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
// import { 
//   createExpenseSchema,
//   updateExpenseSchema,
//   getExpensesQuerySchema
// } from './expense.validation';
// import { ValidationError } from '../../shared/errors/AppError';

// export class ExpenseController {
//   /**
//    * Create expense
//    */
//   async createExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { error, value } = createExpenseSchema.validate(req.body);
//       if (error) {
//         throw new ValidationError(error.details[0].message, error.details);
//       }

//       const expense = await expenseService.createExpense(value, req.user!.userId);

//       const response: ApiResponse = {
//         success: true,
//         message: 'Expense created successfully',
//         data: { expense },
//         timestamp: new Date().toISOString()
//       };

//       res.status(201).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get expense by ID
//    */
//   async getExpenseById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { expenseId } = req.params;
//       const expense = await expenseService.getExpenseById(expenseId, req.user!.userId);

//       const response: ApiResponse = {
//         success: true,
//         message: 'Expense retrieved successfully',
//         data: { expense },
//         timestamp: new Date().toISOString()
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get group expenses
//    */
//   async getGroupExpenses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { groupId } = req.params;
//       const { error, value } = getExpensesQuerySchema.validate(req.query);
//       if (error) {
//         throw new ValidationError(error.details[0].message, error.details);
//       }

//       const result = await expenseService.getGroupExpenses(groupId, req.user!.userId, value);

//       const response: ApiResponse = {
//         success: true,
//         message: 'Group expenses retrieved successfully',
//         data: result,
//         timestamp: new Date().toISOString()
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get user's expenses
//    */
//   async getUserExpenses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { error, value } = getExpensesQuerySchema.validate(req.query);
//       if (error) {
//         throw new ValidationError(error.details[0].message, error.details);
//       }

//       const result = await expenseService.getUserExpenses(req.user!.userId, value);

//       const response: ApiResponse = {
//         success: true,
//         message: 'User expenses retrieved successfully',
//         data: result,
//         timestamp: new Date().toISOString()
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Update expense
//    */
//   async updateExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { expenseId } = req.params;
//       const { error, value } = updateExpenseSchema.validate(req.body);
//       if (error) {
//         throw new ValidationError(error.details[0].message, error.details);
//       }

//       const expense = await expenseService.updateExpense(expenseId, req.user!.userId, value);

//       const response: ApiResponse = {
//         success: true,
//         message: 'Expense updated successfully',
//         data: { expense },
//         timestamp: new Date().toISOString()
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Delete expense
//    */
//   async deleteExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { expenseId } = req.params;
//       await expenseService.deleteExpense(expenseId, req.user!.userId);

//       const response: ApiResponse = {
//         success: true,
//         message: 'Expense deleted successfully',
//         timestamp: new Date().toISOString()
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// export const expenseController = new ExpenseController();

import { Router } from 'express';
import * as expenseController from './expense.controller';
import { protect } from '../auth/auth.middleware';
import { validate } from '../trips/trip.middleware';
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseListQuerySchema,
  expenseParamSchema,
  stopExpenseParamSchema,
  tripExpenseParamSchema,
  markSplitPaidParamSchema,
} from './expense.validation';

const router = Router();

// ============================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================
router.use(protect);

// ============================================================
// SPECIFIC ROUTES (before /:expenseId to avoid conflicts)
// ============================================================

router.get(
  '/mine',
  validate(expenseListQuerySchema, 'query'),
  expenseController.getMyExpenses
);

router.get(
  '/stop/:stopId/summary',
  validate(stopExpenseParamSchema, 'params'),
  expenseController.getStopExpenseSummary
);

router.get(
  '/stop/:stopId',
  validate(stopExpenseParamSchema, 'params'),
  validate(expenseListQuerySchema, 'query'),
  expenseController.getStopExpenses
);

router.get(
  '/trip/:tripId',
  validate(tripExpenseParamSchema, 'params'),
  validate(expenseListQuerySchema, 'query'),
  expenseController.getTripExpenses
);

// ============================================================
// CRUD ROUTES
// ============================================================

router.post(
  '/',
  validate(createExpenseSchema),
  expenseController.createExpense
);

router.get(
  '/:expenseId',
  validate(expenseParamSchema, 'params'),
  expenseController.getExpense
);

router.patch(
  '/:expenseId',
  validate(expenseParamSchema, 'params'),
  validate(updateExpenseSchema),
  expenseController.updateExpense
);

router.delete(
  '/:expenseId',
  validate(expenseParamSchema, 'params'),
  expenseController.archiveExpense
);

router.post(
  '/:expenseId/unarchive',
  validate(expenseParamSchema, 'params'),
  expenseController.unarchiveExpense
);

router.delete(
  '/:expenseId/permanent',
  validate(expenseParamSchema, 'params'),
  expenseController.deleteExpensePermanent
);

// ============================================================
// SETTLEMENT ROUTE
// ============================================================

router.patch(
  '/:expenseId/splits/:userId/pay',
  validate(markSplitPaidParamSchema, 'params'),
  expenseController.markSplitPaid
);

export default router;
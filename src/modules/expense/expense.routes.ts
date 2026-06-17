import { Router } from 'express';
// Import all named exports from the controller as a single object
import * as expenseController from './expense.controller'; 
import { AuthMiddleware } from '../auth/auth.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// SPECIFIC ROUTES 
// (Must come BEFORE /:expenseId to prevent Express from treating "mine" or "stop" as an ID)
// ─────────────────────────────────────────────────────────────────────────────

// All expenses paid by the current user across all trips
router.get('/mine', expenseController.getMyExpenses);

// List expenses for a specific stop
router.get('/stop/:stopId', expenseController.getStopExpenses);

// List ALL expenses across all stops for a trip
router.get('/trip/:tripId', expenseController.getTripExpenses);


// ─────────────────────────────────────────────────────────────────────────────
// STANDARD CRUD & PARAMETERIZED ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Create a new expense
router.post('/', expenseController.createExpense);

// Get a single expense with full split breakdown
router.get('/:expenseId', expenseController.getExpense);

// Update an expense (Note: PATCH instead of PUT based on your JSDoc)
router.patch('/:expenseId', expenseController.updateExpense);

// Delete expense
router.delete('/:expenseId', expenseController.deleteExpense);

// Mark one member's split as paid
router.patch('/:expenseId/splits/:userId/pay', expenseController.markSplitPaid);

export default router;// import { Router } from 'express';
// import { expenseController } from './expense.controller';
// import { AuthMiddleware } from '../auth/auth.middleware';

// const router = Router();

// // All routes require authentication
// router.use(AuthMiddleware.authenticate);

// // Expense CRUD
// router.post('/', expenseController.createExpense.bind(expenseController));
// router.get('/user', expenseController.getUserExpenses.bind(expenseController));
// router.get('/:expenseId', expenseController.getExpenseById.bind(expenseController));
// router.put('/:expenseId', expenseController.updateExpense.bind(expenseController));
// router.delete('/:expenseId', expenseController.deleteExpense.bind(expenseController));

// // Group expenses
// router.get('/group/:groupId', expenseController.getGroupExpenses.bind(expenseController));

// export default router;

import { Router } from 'express';
import { expenseController } from './expense.controller';
import { AuthMiddleware } from '../auth/auth.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Expense CRUD
router.post('/', expenseController.createExpense.bind(expenseController));
router.get('/user', expenseController.getUserExpenses.bind(expenseController));
router.get('/:expenseId', expenseController.getExpenseById.bind(expenseController));
router.put('/:expenseId', expenseController.updateExpense.bind(expenseController));
router.delete('/:expenseId', expenseController.deleteExpense.bind(expenseController));

// Group expenses
router.get('/group/:groupId', expenseController.getGroupExpenses.bind(expenseController));

export default router;
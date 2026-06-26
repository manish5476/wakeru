import { Router } from 'express';
import { FinanceController } from './finance.controller';
import { protect } from '../auth/auth.middleware';

const router = Router();

// Protect all finance routes
router.use(protect);

// Dashboard
router.get('/dashboard', FinanceController.getDashboard);

// Transactions
router.get('/transactions', FinanceController.getTransactions);
router.post('/transactions', FinanceController.addTransaction);

// Budget
router.post('/budget', FinanceController.setBudget);

export default router;

// finance.routes.ts

import { Router } from 'express';
import { FinanceController } from './finance.controller';
import { protect } from '../auth/auth.middleware';

const router = Router();
router.use(protect);

// ─────────────────────────────────────────────────────────────
// DASHBOARD & ANALYTICS
// ─────────────────────────────────────────────────────────────

router.get('/dashboard', FinanceController.getDashboard);
router.get('/analytics', FinanceController.getAnalytics);
router.get('/trends', FinanceController.getSpendingTrends);
router.post('/sync-trips', FinanceController.syncTripExpenses);

// ─────────────────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────────────────

router.get('/transactions', FinanceController.getTransactions);
router.post('/transactions', FinanceController.createTransaction);
router.get('/transactions/:id', FinanceController.getTransactionById);
router.put('/transactions/:id', FinanceController.updateTransaction);
router.delete('/transactions/:id', FinanceController.deleteTransaction);
router.post('/transactions/:id/restore', FinanceController.restoreTransaction);
router.post('/transactions/bulk-delete', FinanceController.bulkDeleteTransactions);

// ─────────────────────────────────────────────────────────────
// BUDGET
// ─────────────────────────────────────────────────────────────

router.get('/budget', FinanceController.getBudget);
router.post('/budget', FinanceController.setBudget);
router.put('/budget/:id', FinanceController.updateBudget);
router.delete('/budget/:id', FinanceController.deleteBudget);
router.get('/budget/categories', FinanceController.getBudgetCategories);

// ─────────────────────────────────────────────────────────────
// BILLS
// ─────────────────────────────────────────────────────────────

router.get('/bills', FinanceController.getBills);
router.post('/bills', FinanceController.createBill);
router.get('/bills/:id', FinanceController.getBillById);
router.put('/bills/:id', FinanceController.updateBill);
router.post('/bills/:id/pay', FinanceController.markBillPaid);
router.post('/bills/:id/skip', FinanceController.skipBill);
router.delete('/bills/:id', FinanceController.deleteBill);

// ─────────────────────────────────────────────────────────────
// GOALS
// ─────────────────────────────────────────────────────────────

router.get('/goals', FinanceController.getGoals);
router.post('/goals', FinanceController.createGoal);
router.get('/goals/:id', FinanceController.getGoalById);
router.put('/goals/:id', FinanceController.updateGoal);
router.post('/goals/:id/contribute', FinanceController.contributeToGoal);
router.delete('/goals/:id', FinanceController.deleteGoal);

// ─────────────────────────────────────────────────────────────
// DEBT & SETTLEMENT
// ─────────────────────────────────────────────────────────────

router.get('/debt/summary', FinanceController.getDebtSummary);
router.get('/debt/details', FinanceController.getDebtDetails);

// ─────────────────────────────────────────────────────────────
// CATEGORIES & TAGS
// ─────────────────────────────────────────────────────────────

router.get('/categories', FinanceController.getCategories);
router.get('/tags', FinanceController.getTags);

// ─────────────────────────────────────────────────────────────
// EXPORT & REPORTING
// ─────────────────────────────────────────────────────────────

router.get('/export', FinanceController.exportTransactions);
router.get('/report/monthly', FinanceController.getMonthlyReport);
router.get('/report/yearly', FinanceController.getYearlyReport);

export default router;


// import { Router } from 'express';
// import { FinanceController } from './finance.controller';
// import { protect } from '../auth/auth.middleware';

// const router = Router();
// router.use(protect);

// // Dashboard & Analytics
// router.get('/dashboard', FinanceController.getDashboard);
// router.get('/analytics', FinanceController.getAnalytics);
// router.post('/sync-trips', FinanceController.syncTripExpenses);

// // Transactions
// router.get('/transactions', FinanceController.getTransactions);
// router.post('/transactions', FinanceController.createTransaction);
// router.get('/transactions/:id', FinanceController.getTransactionById);
// router.put('/transactions/:id', FinanceController.updateTransaction);
// router.delete('/transactions/:id', FinanceController.deleteTransaction);
// router.post('/transactions/:id/restore', FinanceController.restoreTransaction);

// // Budget
// router.get('/budget', FinanceController.getBudget);
// router.post('/budget', FinanceController.setBudget);

// // Bills
// router.get('/bills', FinanceController.getBills);
// router.post('/bills', FinanceController.createBill);
// router.get('/bills/:id', FinanceController.getBillById);
// router.put('/bills/:id', FinanceController.updateBill);
// router.post('/bills/:id/pay', FinanceController.markBillPaid);
// router.delete('/bills/:id', FinanceController.deleteBill);

// // Goals
// router.get('/goals', FinanceController.getGoals);
// router.post('/goals', FinanceController.createGoal);
// router.get('/goals/:id', FinanceController.getGoalById);
// router.put('/goals/:id', FinanceController.updateGoal);
// router.post('/goals/:id/contribute', FinanceController.contributeToGoal);
// router.delete('/goals/:id', FinanceController.deleteGoal);

// export default router;

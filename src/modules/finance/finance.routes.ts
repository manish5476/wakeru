// finance.routes.ts
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
router.post('/transactions', FinanceController.createTransaction);
router.get('/transactions/:id', FinanceController.getTransactionById);
router.put('/transactions/:id', FinanceController.updateTransaction);
router.delete('/transactions/:id', FinanceController.deleteTransaction);
router.post('/transactions/:id/restore', FinanceController.restoreTransaction);

// Budget
router.get('/budget', FinanceController.getBudget);
router.post('/budget', FinanceController.setBudget);

// Bills
router.get('/bills', FinanceController.getBills);
router.post('/bills', FinanceController.createBill);
router.get('/bills/:id', FinanceController.getBillById);
router.put('/bills/:id', FinanceController.updateBill);
router.delete('/bills/:id', FinanceController.deleteBill);

// Goals
router.get('/goals', FinanceController.getGoals);
router.post('/goals', FinanceController.createGoal);
router.get('/goals/:id', FinanceController.getGoalById);
router.put('/goals/:id', FinanceController.updateGoal);
router.delete('/goals/:id', FinanceController.deleteGoal);

export default router;


// import { Router } from 'express';
// import { FinanceController } from './finance.controller';
// import { protect } from '../auth/auth.middleware';

// const router = Router();

// // Protect all finance routes
// router.use(protect);

// // Dashboard
// router.get('/dashboard', FinanceController.getDashboard);

// // Transactions
// router.get('/transactions', FinanceController.getTransactions);
// router.post('/transactions', FinanceController.addTransaction);

// // Budget
// router.post('/budget', FinanceController.setBudget);

// export default router;

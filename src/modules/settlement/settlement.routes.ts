import { Router } from 'express';
import { settlementController } from './settlement.controller';
import { AuthMiddleware } from '../auth/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

// Debt management
router.get('/debts/:groupId', settlementController.getSimplifiedDebts.bind(settlementController));
router.get('/debts/:groupId/summary', settlementController.getDebtSummary.bind(settlementController));

// Settlement operations
router.post('/', settlementController.createSettlement.bind(settlementController));
router.post('/:settlementId/pay', settlementController.processPayment.bind(settlementController));
router.post('/:settlementId/cancel', settlementController.cancelSettlement.bind(settlementController));

// History
router.get('/history/:groupId', settlementController.getSettlementHistory.bind(settlementController));

export default router;
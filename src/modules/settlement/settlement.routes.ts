import { Router } from 'express';
import * as settlementController from './settlement.controller';
import { protect } from '../auth/auth.middleware';
import { validate } from '../trips/trip.middleware';
import {
  tripSettlementParamSchema,
  transactionParamSchema,
  initiatePaymentSchema,
  confirmPaymentSchema,
  confirmTransactionBodySchema,
  disputePaymentSchema,
  retryPaymentSchema,
  settleAllSchema,
  settleSelectedSchema,
  rejectPaymentSchema,
} from './settlement.validation';

const router = Router();

// ============================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================
router.use(protect);

// ============================================================
// MY SETTLEMENTS (MUST BE BEFORE /trip/:tripId)
// ============================================================

router.get('/mine', settlementController.getMySettlements);

// ============================================================
// TRIP SETTLEMENT ROUTES
// ============================================================

/**
 * GET    /api/v1/settlements/trip/:tripId             → Get settlement
 * GET    /api/v1/settlements/trip/:tripId/summary     → Get summary (dashboard)
 * POST   /api/v1/settlements/trip/:tripId/calculate   → Recalculate
 * POST   /api/v1/settlements/trip/:tripId/pay         → Initiate UPI payment
 * POST   /api/v1/settlements/trip/:tripId/retry       → Retry payment
 * POST   /api/v1/settlements/trip/:tripId/confirm     → Confirm payment (body-based)
 * POST   /api/v1/settlements/trip/:tripId/dispute     → Dispute payment
 * GET    /api/v1/settlements/trip/:tripId/export      → Export settlement
 * GET    /api/v1/settlements/trip/:tripId/history     → Settlement history
 * POST   /api/v1/settlements/trip/:tripId/settle-all       → Payer initiates all
 * POST   /api/v1/settlements/trip/:tripId/settle-selected  → Payer initiates selected
 *
 * Transaction-scoped routes (cleaner URL):
 * POST   /api/v1/settlements/trip/:tripId/transactions/:transactionId/settle  → Mark Paid
 * POST   /api/v1/settlements/trip/:tripId/transactions/:transactionId/confirm → Confirm Received
 * POST   /api/v1/settlements/trip/:tripId/transactions/:transactionId/reject  → Reject Payment
 * POST   /api/v1/settlements/trip/:tripId/transactions/:transactionId/remind  → Send Reminder
 */

router.get(
  '/trip/:tripId',
  validate(tripSettlementParamSchema, 'params'),
  settlementController.getSettlement
);

router.get(
  '/trip/:tripId/summary',
  validate(tripSettlementParamSchema, 'params'),
  settlementController.getSettlementSummary
);

router.post(
  '/trip/:tripId/calculate',
  validate(tripSettlementParamSchema, 'params'),
  settlementController.calculateSettlement
);

router.post(
  '/trip/:tripId/pay',
  validate(tripSettlementParamSchema, 'params'),
  validate(initiatePaymentSchema),
  settlementController.initiatePayment
);

router.post(
  '/trip/:tripId/retry',
  validate(tripSettlementParamSchema, 'params'),
  validate(retryPaymentSchema),
  settlementController.retryPayment
);

// Legacy body-based confirm (kept for backward compatibility)
router.post(
  '/trip/:tripId/confirm',
  validate(tripSettlementParamSchema, 'params'),
  validate(confirmPaymentSchema),
  settlementController.confirmPayment
);

router.post(
  '/trip/:tripId/dispute',
  validate(tripSettlementParamSchema, 'params'),
  validate(disputePaymentSchema),
  settlementController.disputePayment
);

router.get(
  '/trip/:tripId/export',
  validate(tripSettlementParamSchema, 'params'),
  settlementController.exportSettlement
);

router.get(
  '/trip/:tripId/history',
  validate(tripSettlementParamSchema, 'params'),
  settlementController.getSettlementHistory
);

// Bulk initiation by payer
router.post(
  '/trip/:tripId/settle-all',
  validate(tripSettlementParamSchema, 'params'),
  validate(settleAllSchema),
  settlementController.settleAll
);

router.post(
  '/trip/:tripId/settle-selected',
  validate(tripSettlementParamSchema, 'params'),
  validate(settleSelectedSchema),
  settlementController.settleSelected
);

// ============================================================
// TRANSACTION-SCOPED ROUTES
// ============================================================

// Payer: Mark Paid (initiates transaction)
router.post(
  '/trip/:tripId/transactions/:transactionId/settle',
  validate(transactionParamSchema, 'params'),
  settlementController.settleSingle
);

// Receiver: Confirm Received
router.post(
  '/trip/:tripId/transactions/:transactionId/confirm',
  validate(transactionParamSchema, 'params'),
  validate(confirmTransactionBodySchema),
  settlementController.confirmTransaction
);

// Receiver: Reject Payment (resets to pending)
router.post(
  '/trip/:tripId/transactions/:transactionId/reject',
  validate(transactionParamSchema, 'params'),
  validate(rejectPaymentSchema),
  settlementController.rejectPayment
);

// Receiver: Remind Payer (30-minute cooldown)
router.post(
  '/trip/:tripId/transactions/:transactionId/remind',
  validate(transactionParamSchema, 'params'),
  settlementController.remindPayer
);

export default router;

import { Router } from 'express';
import * as settlementController from './settlement.controller';
import { protect } from '../auth/auth.middleware';
import { validate } from '../trips/trip.middleware';
import {
  tripSettlementParamSchema,
  initiatePaymentSchema,
  confirmPaymentSchema,
  disputePaymentSchema,
} from './settlement.validation';

const router = Router();

// ============================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================
router.use(protect);

// ============================================================
// SETTLEMENT ROUTES
// ============================================================

/**
 * GET  /api/v1/settlements/trip/:tripId             → Get settlement
 * POST /api/v1/settlements/trip/:tripId/calculate    → Recalculate
 * POST /api/v1/settlements/trip/:tripId/pay          → Initiate UPI payment
 * POST /api/v1/settlements/trip/:tripId/confirm      → Confirm payment
 * POST /api/v1/settlements/trip/:tripId/dispute      → Dispute payment
 */

router.get(
  '/trip/:tripId',
  validate(tripSettlementParamSchema, 'params'),
  settlementController.getSettlement
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

export default router;

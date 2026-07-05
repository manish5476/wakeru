import { Router } from 'express';
import * as settlementController from './settlement.controller';
import { protect } from '../auth/auth.middleware';
import { validate } from '../trips/trip.middleware';
import {
  tripSettlementParamSchema,
  initiatePaymentSchema,
  confirmPaymentSchema,
  disputePaymentSchema,
  retryPaymentSchema,
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
 * POST   /api/v1/settlements/trip/:tripId/confirm     → Confirm payment
 * POST   /api/v1/settlements/trip/:tripId/dispute     → Dispute payment
 * GET    /api/v1/settlements/trip/:tripId/export      → Export settlement
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

export default router;




// import { Router } from 'express';
// import * as settlementController from './settlement.controller';
// import { protect } from '../auth/auth.middleware';
// import { validate } from '../trips/trip.middleware';
// import {
//   tripSettlementParamSchema,
//   initiatePaymentSchema,
//   confirmPaymentSchema,
//   disputePaymentSchema,
// } from './settlement.validation';

// const router = Router();

// // ============================================================
// // ALL ROUTES REQUIRE AUTHENTICATION
// // ============================================================
// router.use(protect);

// // ============================================================
// // SETTLEMENT ROUTES
// // ============================================================

// /**
//  * GET  /api/v1/settlements/trip/:tripId             → Get settlement
//  * POST /api/v1/settlements/trip/:tripId/calculate    → Recalculate
//  * POST /api/v1/settlements/trip/:tripId/pay          → Initiate UPI payment
//  * POST /api/v1/settlements/trip/:tripId/confirm      → Confirm payment
//  * POST /api/v1/settlements/trip/:tripId/dispute      → Dispute payment
//  */

// router.get(
//   '/trip/:tripId',
//   validate(tripSettlementParamSchema, 'params'),
//   settlementController.getSettlement
// );

// router.post(
//   '/trip/:tripId/calculate',
//   validate(tripSettlementParamSchema, 'params'),
//   settlementController.calculateSettlement
// );

// router.post(
//   '/trip/:tripId/pay',
//   validate(tripSettlementParamSchema, 'params'),
//   validate(initiatePaymentSchema),
//   settlementController.initiatePayment
// );

// router.post(
//   '/trip/:tripId/confirm',
//   validate(tripSettlementParamSchema, 'params'),
//   validate(confirmPaymentSchema),
//   settlementController.confirmPayment
// );

// router.post(
//   '/trip/:tripId/dispute',
//   validate(tripSettlementParamSchema, 'params'),
//   validate(disputePaymentSchema),
//   settlementController.disputePayment
// );

// export default router;

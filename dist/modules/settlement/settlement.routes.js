"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settlementController = __importStar(require("./settlement.controller"));
const auth_middleware_1 = require("../auth/auth.middleware");
const trip_middleware_1 = require("../trips/trip.middleware");
const settlement_validation_1 = require("./settlement.validation");
const router = (0, express_1.Router)();
// ============================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================
router.use(auth_middleware_1.protect);
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
router.get('/trip/:tripId', (0, trip_middleware_1.validate)(settlement_validation_1.tripSettlementParamSchema, 'params'), settlementController.getSettlement);
router.post('/trip/:tripId/calculate', (0, trip_middleware_1.validate)(settlement_validation_1.tripSettlementParamSchema, 'params'), settlementController.calculateSettlement);
router.post('/trip/:tripId/pay', (0, trip_middleware_1.validate)(settlement_validation_1.tripSettlementParamSchema, 'params'), (0, trip_middleware_1.validate)(settlement_validation_1.initiatePaymentSchema), settlementController.initiatePayment);
router.post('/trip/:tripId/confirm', (0, trip_middleware_1.validate)(settlement_validation_1.tripSettlementParamSchema, 'params'), (0, trip_middleware_1.validate)(settlement_validation_1.confirmPaymentSchema), settlementController.confirmPayment);
router.post('/trip/:tripId/dispute', (0, trip_middleware_1.validate)(settlement_validation_1.tripSettlementParamSchema, 'params'), (0, trip_middleware_1.validate)(settlement_validation_1.disputePaymentSchema), settlementController.disputePayment);
exports.default = router;
//# sourceMappingURL=settlement.routes.js.map
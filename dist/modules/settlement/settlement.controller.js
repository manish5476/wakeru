"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disputePayment = exports.confirmPayment = exports.initiatePayment = exports.calculateSettlement = exports.getSettlement = void 0;
const settlement_service_1 = require("./settlement.service");
const AppError_1 = require("../../shared/errors/AppError");
// ============================================================
// HELPER
// ============================================================
const getUser = (req) => {
    const user = req.user;
    if (!user?.userId)
        throw new AppError_1.AppError('Not authenticated', 401);
    return {
        uid: user.userId,
        displayName: user.displayName || 'User',
    };
};
// ============================================================
// CONTROLLERS
// ============================================================
/**
 * GET /api/v1/settlements/trip/:tripId
 * Get current settlement plan (auto-calculates if needed).
 */
const getSettlement = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { tripId } = req.params;
        const settlement = await settlement_service_1.settlementService.getSettlement(tripId, user.uid);
        res.status(200).json({
            success: true,
            data: {
                settlement,
                summary: {
                    totalTransactions: settlement.totalTransactions,
                    totalAmount: settlement.transactions.reduce((s, t) => s + t.amountBase, 0),
                    pendingCount: settlement.transactions.filter((t) => t.status === 'pending').length,
                    confirmedCount: settlement.transactions.filter((t) => t.status === 'confirmed').length,
                    baseCurrency: settlement.baseCurrency,
                    isStale: settlement.isStale,
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getSettlement = getSettlement;
/**
 * POST /api/v1/settlements/trip/:tripId/calculate
 * Force recalculate settlement.
 */
const calculateSettlement = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { tripId } = req.params;
        const settlement = await settlement_service_1.settlementService.calculateSettlement(tripId, user.uid);
        res.status(200).json({
            success: true,
            message: `Settlement calculated — ${settlement.totalTransactions} transfers needed`,
            data: { settlement },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.calculateSettlement = calculateSettlement;
/**
 * POST /api/v1/settlements/trip/:tripId/pay
 * Initiate UPI payment for a settlement transaction.
 */
const initiatePayment = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { tripId } = req.params;
        const { transactionId } = req.body;
        const result = await settlement_service_1.settlementService.initiatePayment(tripId, transactionId, user.uid);
        res.status(200).json({
            success: true,
            message: 'Payment initiated. Open the UPI link to complete.',
            data: {
                transaction: result.transaction,
                upiDeepLink: result.upiDeepLink,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.initiatePayment = initiatePayment;
/**
 * POST /api/v1/settlements/trip/:tripId/confirm
 * Confirm receipt of a payment (recipient only).
 */
const confirmPayment = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { tripId } = req.params;
        const { transactionId } = req.body;
        const settlement = await settlement_service_1.settlementService.confirmPayment(tripId, transactionId, user.uid);
        res.status(200).json({
            success: true,
            message: 'Payment confirmed. Related expenses updated.',
            data: {
                settlement,
                isFullySettled: settlement.transactions.every((t) => t.status === 'confirmed'),
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.confirmPayment = confirmPayment;
/**
 * POST /api/v1/settlements/trip/:tripId/dispute
 * Dispute a payment.
 */
const disputePayment = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { tripId } = req.params;
        const { transactionId } = req.body;
        const settlement = await settlement_service_1.settlementService.disputePayment(tripId, transactionId, user.uid);
        res.status(200).json({
            success: true,
            message: 'Payment disputed. Trip members will be notified.',
            data: { settlement },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.disputePayment = disputePayment;
//# sourceMappingURL=settlement.controller.js.map
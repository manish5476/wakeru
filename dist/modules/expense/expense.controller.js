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
exports.markSplitPaid = exports.deleteExpense = exports.updateExpense = exports.getExpense = exports.getMyExpenses = exports.getTripExpenses = exports.getStopExpenses = exports.createExpense = void 0;
const expenseService = __importStar(require("./expense.service"));
const AppError_1 = require("@shared/errors/AppError");
const getUser = (req) => {
    const user = req.user;
    if (!user?.uid)
        throw new AppError_1.AppError('Not authenticated', 401);
    return user;
};
// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/expenses
 * Create a new expense.
 * Body must include stopId — the trip is resolved from the stop.
 */
const createExpense = async (req, res, next) => {
    try {
        const user = getUser(req);
        const input = req.body;
        const expense = await expenseService.createExpense(input, user.uid, user.displayName);
        res.status(201).json({
            success: true,
            message: 'Expense added successfully',
            data: { expense },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.createExpense = createExpense;
/**
 * GET /api/v1/expenses/stop/:stopId
 * List expenses for a specific stop (paginated, filterable).
 * Query: page, limit, category, paidBy, isSettled, startDate, endDate, sortBy, sortOrder
 */
const getStopExpenses = async (req, res, next) => {
    try {
        const { stopId } = req.params;
        const query = req.query;
        const result = await expenseService.getStopExpenses(stopId, query);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getStopExpenses = getStopExpenses;
/**
 * GET /api/v1/expenses/trip/:tripId
 * List ALL expenses across all stops for a trip.
 * Used for the unified trip expense view.
 */
const getTripExpenses = async (req, res, next) => {
    try {
        const { tripId } = req.params;
        const query = req.query;
        const result = await expenseService.getTripExpenses(tripId, query);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getTripExpenses = getTripExpenses;
/**
 * GET /api/v1/expenses/mine
 * All expenses paid by the current user across all trips.
 */
const getMyExpenses = async (req, res, next) => {
    try {
        const user = getUser(req);
        const query = req.query;
        const result = await expenseService.getMyExpenses(user.uid, query);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getMyExpenses = getMyExpenses;
/**
 * GET /api/v1/expenses/:expenseId
 * Get a single expense with full split breakdown.
 */
const getExpense = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { expenseId } = req.params;
        const expense = await expenseService.getExpenseById(expenseId, user.uid);
        res.status(200).json({
            success: true,
            data: { expense },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getExpense = getExpense;
/**
 * PATCH /api/v1/expenses/:expenseId
 * Update an expense. Recalculates splits & cached totals if amount/split changes.
 */
const updateExpense = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { expenseId } = req.params;
        const input = req.body;
        const updated = await expenseService.updateExpense(expenseId, input, user.uid);
        res.status(200).json({
            success: true,
            message: 'Expense updated',
            data: { expense: updated },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.updateExpense = updateExpense;
/**
 * DELETE /api/v1/expenses/:expenseId
 * Delete expense + reverse all cached totals.
 * Only payer or trip admin can delete.
 */
const deleteExpense = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { expenseId } = req.params;
        await expenseService.deleteExpense(expenseId, user.uid);
        res.status(200).json({
            success: true,
            message: 'Expense deleted and totals updated',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteExpense = deleteExpense;
/**
 * PATCH /api/v1/expenses/:expenseId/splits/:userId/pay
 * Mark one member's split as paid (manual confirmation).
 * Used when UPI is done outside the app, or for cash payments.
 */
const markSplitPaid = async (req, res, next) => {
    try {
        const { expenseId, userId } = req.params;
        const { paymentId } = req.body;
        const expense = await expenseService.markSplitPaid(expenseId, userId, paymentId);
        res.status(200).json({
            success: true,
            message: 'Split marked as paid',
            data: {
                expense,
                isFullySettled: expense.isSettled,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.markSplitPaid = markSplitPaid;
//# sourceMappingURL=expense.controller.js.map
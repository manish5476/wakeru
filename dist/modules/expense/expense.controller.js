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
exports.markSplitPaid = exports.deleteExpensePermanent = exports.unarchiveExpense = exports.archiveExpense = exports.updateExpense = exports.getExpense = exports.getMyExpenses = exports.getTripExpenses = exports.getStopExpenseSummary = exports.getStopExpenses = exports.createExpense = void 0;
const expenseService = __importStar(require("./expense.service"));
const AppError_1 = require("../../shared/errors/AppError");
// ============================================================
// HELPERS
// ============================================================
const getUser = (req) => {
    const user = req.user;
    if (!user?.userId)
        throw new AppError_1.AppError('Not authenticated', 401);
    return {
        uid: user.userId,
        displayName: user.displayName || 'User',
        photoURL: user.photoURL,
    };
};
// ============================================================
// CREATE
// ============================================================
/**
 * POST /api/v1/expenses
 * Create a new expense with split computation.
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
// ============================================================
// READ
// ============================================================
/**
 * GET /api/v1/expenses/stop/:stopId
 * List expenses for a specific stop.
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
 * GET /api/v1/expenses/stop/:stopId/summary
 * Get expense summary for a specific stop.
 */
const getStopExpenseSummary = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { stopId } = req.params;
        const result = await expenseService.getStopExpenseSummary(stopId, user.uid);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getStopExpenseSummary = getStopExpenseSummary;
/**
 * GET /api/v1/expenses/trip/:tripId
 * List ALL expenses across all stops for a trip.
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
 * All expenses paid by current user across all trips.
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
// ============================================================
// UPDATE
// ============================================================
/**
 * PATCH /api/v1/expenses/:expenseId
 * Update expense — recalculates splits & cached totals if needed.
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
// ============================================================
// DELETE
// ============================================================
/**
 * DELETE /api/v1/expenses/:expenseId
 * Archive expense + reverse all cached totals.
 */
const archiveExpense = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { expenseId } = req.params;
        await expenseService.archiveExpense(expenseId, user.uid);
        res.status(200).json({
            success: true,
            message: 'Expense archived and totals updated',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.archiveExpense = archiveExpense;
/**
 * POST /api/v1/expenses/:expenseId/unarchive
 * Unarchive expense + restore cached totals.
 */
const unarchiveExpense = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { expenseId } = req.params;
        await expenseService.unarchiveExpense(expenseId, user.uid);
        res.status(200).json({
            success: true,
            message: 'Expense unarchived and totals restored',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.unarchiveExpense = unarchiveExpense;
/**
 * DELETE /api/v1/expenses/:expenseId/permanent
 * Permanently delete expense.
 */
const deleteExpensePermanent = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { expenseId } = req.params;
        await expenseService.deleteExpensePermanent(expenseId, user.uid);
        res.status(200).json({
            success: true,
            message: 'Expense deleted permanently',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteExpensePermanent = deleteExpensePermanent;
// ============================================================
// SETTLEMENT
// ============================================================
/**
 * PATCH /api/v1/expenses/:expenseId/splits/:userId/pay
 * Mark one member's split as paid.
 */
const markSplitPaid = async (req, res, next) => {
    try {
        const user = getUser(req);
        const { expenseId, userId } = req.params;
        const { paymentId } = req.body;
        const expense = await expenseService.markSplitPaid(expenseId, userId, user.uid, paymentId);
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
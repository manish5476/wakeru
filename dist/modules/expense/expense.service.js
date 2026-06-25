"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markSplitPaid = exports.deleteExpensePermanent = exports.unarchiveExpense = exports.archiveExpense = exports.updateExpense = exports.getExpenseById = exports.getMyExpenses = exports.getTripExpenses = exports.getStopExpenses = exports.createExpense = exports.computeSplits = void 0;
const mongoose_1 = require("mongoose");
const expense_model_1 = require("./expense.model");
const stop_model_1 = require("../trips/stop.model");
const trip_model_1 = require("../trips/trip.model");
const trip_service_1 = require("../trips/trip.service");
const AppError_1 = require("../../shared/errors/AppError");
const settlement_service_1 = require("../settlement/settlement.service");
const socket_server_1 = require("../../infrastructure/websocket/socket.server");
// ============================================================
// SPLIT ENGINE — The Core of TripSplit
// ============================================================
/**
 * Compute per-member splits in BOTH currencies.
 *
 * For 'equal' splits, the remainder from rounding is distributed
 * to the first N members (prevents ₹0.01 gaps).
 *
 * For 'personal' splits, the payer owns the full cost — no debt created,
 * the split is marked as paid immediately.
 */
const computeSplits = (splitInput, amountLocal, amountBase, exchangeRate, paidByUid, allTripMembers) => {
    const memberMap = new Map(allTripMembers.map((m) => [m.userId, m.displayName]));
    switch (splitInput.method) {
        // ── PERSONAL ─────────────────────────────────────────────
        case 'personal': {
            const displayName = memberMap.get(paidByUid) ?? 'Unknown';
            return [
                {
                    userId: paidByUid,
                    displayName,
                    amountLocal,
                    amountBase,
                    isPaid: true,
                },
            ];
        }
        // ── EQUAL ────────────────────────────────────────────────
        case 'equal': {
            const { memberIds } = splitInput;
            if (memberIds.length === 0) {
                throw new AppError_1.AppError('At least one member is required for equal split', 400);
            }
            const n = memberIds.length;
            const basePerPerson = Math.floor((amountLocal / n) * 100) / 100;
            const remainderCents = Math.round((amountLocal - basePerPerson * n) * 100);
            return memberIds.map((uid, i) => {
                const local = i < remainderCents
                    ? parseFloat((basePerPerson + 0.01).toFixed(2))
                    : basePerPerson;
                const base = parseFloat((local * exchangeRate).toFixed(2));
                return {
                    userId: uid,
                    displayName: memberMap.get(uid) ?? 'Unknown',
                    amountLocal: local,
                    amountBase: base,
                    isPaid: uid === paidByUid,
                };
            });
        }
        // ── PERCENTAGE ───────────────────────────────────────────
        case 'percentage': {
            const totalPct = splitInput.members.reduce((s, m) => s + m.percentage, 0);
            if (Math.abs(totalPct - 100) > 0.01) {
                throw new AppError_1.AppError('Percentages must sum to 100', 400);
            }
            return splitInput.members.map((m) => {
                const local = parseFloat(((amountLocal * m.percentage) / 100).toFixed(2));
                const base = parseFloat((local * exchangeRate).toFixed(2));
                return {
                    userId: m.userId,
                    displayName: m.displayName,
                    amountLocal: local,
                    amountBase: base,
                    percentage: m.percentage,
                    isPaid: m.userId === paidByUid,
                };
            });
        }
        // ── EXACT ────────────────────────────────────────────────
        case 'exact': {
            const totalExact = splitInput.members.reduce((s, m) => s + m.amountLocal, 0);
            if (Math.abs(totalExact - amountLocal) > 0.01) {
                throw new AppError_1.AppError(`Exact amounts must sum to ${amountLocal} (got ${totalExact.toFixed(2)})`, 400);
            }
            return splitInput.members.map((m) => {
                const base = parseFloat((m.amountLocal * exchangeRate).toFixed(2));
                return {
                    userId: m.userId,
                    displayName: m.displayName,
                    amountLocal: m.amountLocal,
                    amountBase: base,
                    isPaid: m.userId === paidByUid,
                };
            });
        }
        // ── SHARES ───────────────────────────────────────────────
        case 'shares': {
            const totalShares = splitInput.members.reduce((s, m) => s + m.shares, 0);
            if (totalShares <= 0) {
                throw new AppError_1.AppError('Total shares must be greater than 0', 400);
            }
            return splitInput.members.map((m) => {
                const local = parseFloat(((amountLocal * m.shares) / totalShares).toFixed(2));
                const base = parseFloat((local * exchangeRate).toFixed(2));
                return {
                    userId: m.userId,
                    displayName: m.displayName,
                    amountLocal: local,
                    amountBase: base,
                    shares: m.shares,
                    isPaid: m.userId === paidByUid,
                };
            });
        }
        default:
            throw new AppError_1.AppError('Unknown split method', 400);
    }
};
exports.computeSplits = computeSplits;
// ============================================================
// CREATE EXPENSE
// ============================================================
/**
 * Create an expense inside a trip stop.
 *
 * Flow:
 * 1. Load trip to get stop details (currency, exchange rate, members)
 * 2. Compute amountBase = amountLocal × currentExchangeRate
 * 3. Compute per-member splits in both currencies
 * 4. Save expense document
 * 5. Atomically update trip/stop cached totals via $inc
 */
const createExpense = async (input, adderUid, adderDisplayName) => {
    const stop = await stop_model_1.Stop.findById(input.stopId);
    if (!stop) {
        throw new AppError_1.AppError('Stop not found', 404);
    }
    const trip = await trip_model_1.Trip.findById(stop.tripId);
    if (!trip || trip.isArchived) {
        throw new AppError_1.AppError('Trip not found or archived', 404);
    }
    if (!trip.isMember(adderUid)) {
        throw new AppError_1.AppError('You are not a member of this trip', 403);
    }
    if (!trip.canEdit(adderUid)) {
        throw new AppError_1.AppError('Viewers cannot add expenses', 403);
    }
    // Validate payer is an active trip member
    const payer = trip.getMember(input.paidBy);
    if (!payer) {
        throw new AppError_1.AppError('The specified payer is not an active member of this trip', 400);
    }
    const isAdderAdmin = trip.isAdmin(adderUid);
    if (!trip.allowAnyPayer && input.paidBy !== adderUid && !isAdderAdmin) {
        throw new AppError_1.AppError('Trip settings do not allow selecting other members as the payer', 403);
    }
    // Compute base amount using CURRENT exchange rate (locked at creation time)
    const exchangeRateUsed = stop.currentExchangeRate;
    const amountBase = parseFloat((input.amountLocal * exchangeRateUsed).toFixed(2));
    // Get all active members for split computation
    const activeMembers = trip
        .getActiveMembers()
        .map((m) => ({ userId: m.userId, displayName: m.displayName }));
    // Compute splits
    const splits = (0, exports.computeSplits)(input.split, input.amountLocal, amountBase, exchangeRateUsed, input.paidBy, activeMembers);
    // Create expense document
    const expense = new expense_model_1.Expense({
        tripId: trip._id,
        stopId: new mongoose_1.Types.ObjectId(input.stopId),
        title: input.title,
        category: input.category,
        notes: input.notes,
        date: input.date,
        amountLocal: input.amountLocal,
        amountBase,
        location: input.location,
        localCurrency: stop.currency,
        baseCurrency: trip.baseCurrency,
        exchangeRateUsed,
        paidBy: input.paidBy,
        paidByName: payer.displayName,
        splitMethod: input.split.method,
        splits,
        addedBy: adderUid,
        isSettled: input.split.method === 'personal',
    });
    await expense.save();
    // Update cached totals on Trip (atomic $inc — safe under concurrency)
    const owedAmounts = splits
        .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));
    await (0, trip_service_1.incrementStopTotals)(trip._id.toString(), input.stopId, input.amountLocal, amountBase, input.paidBy, owedAmounts);
    await (0, settlement_service_1.markSettlementStale)(trip._id.toString());
    socket_server_1.socketServer.notifyExpenseAdded(trip._id.toString(), expense, adderUid);
    return expense;
};
exports.createExpense = createExpense;
// ============================================================
// READ EXPENSES
// ============================================================
/**
 * Get expenses for a specific stop (paginated, filterable).
 */
const getStopExpenses = async (stopId, query) => {
    const filter = {
        stopId: new mongoose_1.Types.ObjectId(stopId),
        isArchived: query.isArchived === true,
    };
    if (query.category)
        filter.category = query.category;
    if (query.paidBy)
        filter.paidBy = query.paidBy;
    if (query.isSettled !== undefined)
        filter.isSettled = query.isSettled;
    if (query.startDate || query.endDate) {
        filter.date = {};
        if (query.startDate)
            filter.date.$gte = new Date(query.startDate);
        if (query.endDate)
            filter.date.$lte = new Date(query.endDate);
    }
    const skip = (query.page - 1) * query.limit;
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const [expenses, total] = await Promise.all([
        expense_model_1.Expense.find(filter)
            .sort({ [query.sortBy]: sortDir })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        expense_model_1.Expense.countDocuments(filter),
    ]);
    return {
        expenses,
        pagination: {
            total,
            page: query.page,
            limit: query.limit,
            pages: Math.ceil(total / query.limit),
            hasMore: skip + expenses.length < total,
        },
    };
};
exports.getStopExpenses = getStopExpenses;
/**
 * Get all expenses across ALL stops for a trip.
 */
const getTripExpenses = async (tripId, query) => {
    const filter = {
        tripId: new mongoose_1.Types.ObjectId(tripId),
        isArchived: query.isArchived === true,
    };
    if (query.category)
        filter.category = query.category;
    if (query.paidBy)
        filter.paidBy = query.paidBy;
    if (query.isSettled !== undefined)
        filter.isSettled = query.isSettled;
    if (query.startDate || query.endDate) {
        filter.date = {};
        if (query.startDate)
            filter.date.$gte = new Date(query.startDate);
        if (query.endDate)
            filter.date.$lte = new Date(query.endDate);
    }
    const skip = (query.page - 1) * query.limit;
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const [expenses, total] = await Promise.all([
        expense_model_1.Expense.find(filter)
            .sort({ [query.sortBy]: sortDir })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        expense_model_1.Expense.countDocuments(filter),
    ]);
    return {
        expenses,
        pagination: {
            total,
            page: query.page,
            limit: query.limit,
            pages: Math.ceil(total / query.limit),
            hasMore: skip + expenses.length < total,
        },
    };
};
exports.getTripExpenses = getTripExpenses;
/**
 * Get all expenses paid by a specific user across all trips.
 */
const getMyExpenses = async (userId, query) => {
    const filter = {
        $or: [
            { paidBy: userId },
            { 'splits.userId': userId }
        ],
        isArchived: query.isArchived === true,
    };
    if (query.category)
        filter.category = query.category;
    if (query.isSettled !== undefined)
        filter.isSettled = query.isSettled;
    const skip = (query.page - 1) * query.limit;
    const [expenses, total] = await Promise.all([
        expense_model_1.Expense.find(filter)
            .sort({ date: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        expense_model_1.Expense.countDocuments(filter),
    ]);
    return {
        expenses,
        pagination: {
            total,
            page: query.page,
            limit: query.limit,
            pages: Math.ceil(total / query.limit),
        },
    };
};
exports.getMyExpenses = getMyExpenses;
/**
 * Get a single expense by ID.
 * Validates the requester is a member of the trip.
 */
const getExpenseById = async (expenseId, requestingUid) => {
    const expense = await expense_model_1.Expense.findById(expenseId);
    if (!expense) {
        throw new AppError_1.AppError('Expense not found', 404);
    }
    // Verify trip membership
    const trip = await trip_model_1.Trip.findById(expense.tripId);
    if (!trip || !trip.isMember(requestingUid)) {
        throw new AppError_1.AppError('You are not a member of this trip', 403);
    }
    return expense;
};
exports.getExpenseById = getExpenseById;
// ============================================================
// UPDATE EXPENSE
// ============================================================
/**
 * Update an expense.
 *
 * If amount, payer, or split changes:
 * 1. Reverse old cached totals (negative $inc)
 * 2. Recompute splits
 * 3. Apply new cached totals
 *
 * Exchange rate is NOT re-fetched — we keep the rate locked at creation.
 */
const updateExpense = async (expenseId, input, editorUid) => {
    const expense = await expense_model_1.Expense.findById(expenseId);
    if (!expense)
        throw new AppError_1.AppError('Expense not found', 404);
    const trip = await trip_model_1.Trip.findById(expense.tripId);
    if (!trip)
        throw new AppError_1.AppError('Trip not found', 404);
    if (!trip.canEdit(editorUid)) {
        throw new AppError_1.AppError('You cannot edit expenses in this trip', 403);
    }
    // Capture old values for cache reversal
    const oldAmountLocal = expense.amountLocal;
    const oldAmountBase = expense.amountBase;
    const oldPaidBy = expense.paidBy;
    const oldOwedAmounts = expense.splits
        .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));
    // Apply simple field updates
    if (input.title !== undefined)
        expense.title = input.title;
    if (input.category !== undefined)
        expense.category = input.category;
    if (input.notes !== undefined)
        expense.notes = input.notes;
    if (input.date !== undefined)
        expense.date = input.date;
    if (input.location !== undefined)
        expense.location = input.location;
    const needsSplitRecompute = input.amountLocal !== undefined ||
        input.paidBy !== undefined ||
        input.split !== undefined;
    if (needsSplitRecompute) {
        const newAmountLocal = input.amountLocal ?? expense.amountLocal;
        const newPaidBy = input.paidBy ?? expense.paidBy;
        const newSplitInput = input.split ?? buildCurrentSplitInput(expense);
        // Validate payer
        const payer = trip.getMember(newPaidBy);
        if (!payer)
            throw new AppError_1.AppError('Payer is not an active trip member', 400);
        const isEditorAdmin = trip.isAdmin(editorUid);
        if (!trip.allowAnyPayer && newPaidBy !== editorUid && !isEditorAdmin) {
            throw new AppError_1.AppError('Trip settings do not allow selecting other members as the payer', 403);
        }
        const newAmountBase = parseFloat((newAmountLocal * expense.exchangeRateUsed).toFixed(2));
        const activeMembers = trip
            .getActiveMembers()
            .map((m) => ({ userId: m.userId, displayName: m.displayName }));
        const newSplits = (0, exports.computeSplits)(newSplitInput, newAmountLocal, newAmountBase, expense.exchangeRateUsed, newPaidBy, activeMembers);
        // Reverse old caches
        await (0, trip_service_1.decrementStopTotals)(trip._id.toString(), expense.stopId.toString(), oldAmountLocal, oldAmountBase, oldPaidBy, oldOwedAmounts);
        // Apply new values
        expense.amountLocal = newAmountLocal;
        expense.amountBase = newAmountBase;
        expense.paidBy = newPaidBy;
        expense.paidByName = payer.displayName;
        expense.splitMethod = newSplitInput.method;
        expense.splits = newSplits;
        await expense.save();
        // Apply new caches
        const newOwedAmounts = newSplits
            .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));
        await (0, trip_service_1.incrementStopTotals)(trip._id.toString(), expense.stopId.toString(), newAmountLocal, newAmountBase, newPaidBy, newOwedAmounts);
    }
    else {
        await expense.save();
    }
    // Track editor
    expense.editedBy = editorUid;
    expense.editedAt = new Date();
    await expense.save();
    await (0, settlement_service_1.markSettlementStale)(trip._id.toString());
    socket_server_1.socketServer.notifyExpenseUpdated(trip._id.toString(), {
        _id: expense._id,
        title: expense.title,
    }, editorUid);
    return expense;
};
exports.updateExpense = updateExpense;
// ============================================================
// DELETE EXPENSE
// ============================================================
/**
 * Soft delete an expense and reverse all cached totals.
 */
const archiveExpense = async (expenseId, requestingUid) => {
    const expense = await expense_model_1.Expense.findById(expenseId);
    if (!expense)
        throw new AppError_1.AppError('Expense not found', 404);
    if (expense.isArchived)
        return expense;
    const trip = await trip_model_1.Trip.findById(expense.tripId);
    if (!trip)
        throw new AppError_1.AppError('Trip not found', 404);
    const isPayerOrAdmin = expense.paidBy === requestingUid || trip.isAdmin(requestingUid);
    if (!isPayerOrAdmin) {
        throw new AppError_1.AppError('Only the payer or a trip admin can archive this expense', 403);
    }
    const owedAmounts = expense.splits
        .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));
    await (0, trip_service_1.decrementStopTotals)(trip._id.toString(), expense.stopId.toString(), expense.amountLocal, expense.amountBase, expense.paidBy, owedAmounts);
    await (0, settlement_service_1.markSettlementStale)(trip._id.toString());
    expense.isArchived = true;
    await expense.save();
    socket_server_1.socketServer.notifyExpenseDeleted(trip._id.toString(), expense.title, requestingUid);
    return expense;
};
exports.archiveExpense = archiveExpense;
/**
 * Unarchive an expense and restore all cached totals.
 */
const unarchiveExpense = async (expenseId, requestingUid) => {
    const expense = await expense_model_1.Expense.findById(expenseId);
    if (!expense)
        throw new AppError_1.AppError('Expense not found', 404);
    if (!expense.isArchived)
        return expense;
    const trip = await trip_model_1.Trip.findById(expense.tripId);
    if (!trip)
        throw new AppError_1.AppError('Trip not found', 404);
    const isPayerOrAdmin = expense.paidBy === requestingUid || trip.isAdmin(requestingUid);
    if (!isPayerOrAdmin) {
        throw new AppError_1.AppError('Only the payer or a trip admin can unarchive this expense', 403);
    }
    const owedAmounts = expense.splits
        .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));
    await (0, trip_service_1.incrementStopTotals)(trip._id.toString(), expense.stopId.toString(), expense.amountLocal, expense.amountBase, expense.paidBy, owedAmounts);
    await (0, settlement_service_1.markSettlementStale)(trip._id.toString());
    expense.isArchived = false;
    await expense.save();
    socket_server_1.socketServer.notifyExpenseAdded(trip._id.toString(), expense, requestingUid);
    return expense;
};
exports.unarchiveExpense = unarchiveExpense;
/**
 * Permanently delete an expense.
 */
const deleteExpensePermanent = async (expenseId, requestingUid) => {
    const expense = await expense_model_1.Expense.findById(expenseId);
    if (!expense)
        throw new AppError_1.AppError('Expense not found', 404);
    const trip = await trip_model_1.Trip.findById(expense.tripId);
    if (!trip)
        throw new AppError_1.AppError('Trip not found', 404);
    const isPayerOrAdmin = expense.paidBy === requestingUid || trip.isAdmin(requestingUid);
    if (!isPayerOrAdmin) {
        throw new AppError_1.AppError('Only the payer or a trip admin can delete this expense permanently', 403);
    }
    if (!expense.isArchived) {
        const owedAmounts = expense.splits
            .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));
        await (0, trip_service_1.decrementStopTotals)(trip._id.toString(), expense.stopId.toString(), expense.amountLocal, expense.amountBase, expense.paidBy, owedAmounts);
        await (0, settlement_service_1.markSettlementStale)(trip._id.toString());
        socket_server_1.socketServer.notifyExpenseDeleted(trip._id.toString(), expense.title, requestingUid);
    }
    await expense.deleteOne();
};
exports.deleteExpensePermanent = deleteExpensePermanent;
// ============================================================
// MARK SPLIT AS PAID
// ============================================================
/**
 * Mark one member's split as paid (manual or UPI confirmation).
 * Auto-updates isSettled if all splits are now paid.
 */
const markSplitPaid = async (expenseId, targetUserId, requestingUid, paymentId) => {
    const expense = await expense_model_1.Expense.findById(expenseId);
    if (!expense)
        throw new AppError_1.AppError('Expense not found', 404);
    if (expense.paidBy !== requestingUid) {
        throw new AppError_1.AppError('Only the payer can mark this expense as paid', 403);
    }
    const split = expense.splits.find((s) => s.userId === targetUserId);
    if (!split)
        throw new AppError_1.AppError('Split not found for this user', 404);
    if (split.isPaid)
        throw new AppError_1.AppError('This split is already marked as paid', 400);
    split.isPaid = true;
    split.paidAt = new Date();
    if (paymentId) {
        split.paymentId = new mongoose_1.Types.ObjectId(paymentId);
    }
    await expense.save();
    return expense;
};
exports.markSplitPaid = markSplitPaid;
// ============================================================
// PRIVATE HELPERS
// ============================================================
/**
 * Reconstruct SplitInput from existing expense for cache reversal.
 */
function buildCurrentSplitInput(expense) {
    const method = expense.splitMethod;
    switch (method) {
        case 'personal':
            return { method: 'personal' };
        case 'equal':
            return {
                method: 'equal',
                memberIds: expense.splits.map((s) => s.userId),
            };
        case 'percentage':
            return {
                method: 'percentage',
                members: expense.splits.map((s) => ({
                    userId: s.userId,
                    displayName: s.displayName,
                    percentage: s.percentage ?? 0,
                })),
            };
        case 'exact':
            return {
                method: 'exact',
                members: expense.splits.map((s) => ({
                    userId: s.userId,
                    displayName: s.displayName,
                    amountLocal: s.amountLocal,
                })),
            };
        case 'shares':
            return {
                method: 'shares',
                members: expense.splits.map((s) => ({
                    userId: s.userId,
                    displayName: s.displayName,
                    shares: s.shares ?? 1,
                })),
            };
        default:
            throw new AppError_1.AppError('Unknown split method on existing expense', 500);
    }
}
//# sourceMappingURL=expense.service.js.map
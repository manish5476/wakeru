"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementService = exports.disputePayment = exports.confirmPayment = exports.initiatePayment = exports.markSettlementStale = exports.getSettlement = exports.calculateSettlement = exports.computeMinimumTransactions = void 0;
const mongoose_1 = require("mongoose");
const settlement_model_1 = require("./settlement.model");
const expense_model_1 = require("../expense/expense.model");
const trip_model_1 = require("../trips/trip.model");
const auth_model_1 = require("../auth/auth.model");
const AppError_1 = require("../../shared/errors/AppError");
const socket_server_1 = require("../../infrastructure/websocket/socket.server");
// ============================================================
// MINIMUM TRANSACTION ALGORITHM
// ============================================================
/**
 * Greedy minimum-transaction settlement algorithm.
 *
 * For N people: max N-1 transfers (instead of O(N²) naive).
 * Example: 8 friends, 47 expenses → max 7 transfers.
 *
 * Algorithm:
 * 1. Compute net balance per person
 * 2. Split into creditors (+) and debtors (-)
 * 3. Greedily match largest creditor with largest debtor
 */
const computeMinimumTransactions = (balances) => {
    const EPSILON = 0.01; // Ignore balances below 1 paisa
    // Creditors: people who are OWED money (positive balance)
    const creditors = balances
        .filter((b) => b.amount > EPSILON)
        .sort((a, b) => b.amount - a.amount);
    // Debtors: people who OWE money (negative balance → flip to positive)
    const debtors = balances
        .filter((b) => b.amount < -EPSILON)
        .map((b) => ({ ...b, amount: -b.amount }))
        .sort((a, b) => b.amount - a.amount);
    const transactions = [];
    let i = 0; // Creditor index
    let j = 0; // Debtor index
    while (i < creditors.length && j < debtors.length) {
        const settleAmount = Math.min(creditors[i].amount, debtors[j].amount);
        const rounded = parseFloat(settleAmount.toFixed(2));
        if (rounded > 0) {
            transactions.push({
                from: debtors[j].userId,
                fromName: debtors[j].displayName,
                to: creditors[i].userId,
                toName: creditors[i].displayName,
                amount: rounded,
            });
        }
        creditors[i].amount -= settleAmount;
        debtors[j].amount -= settleAmount;
        if (creditors[i].amount < EPSILON)
            i++;
        if (debtors[j].amount < EPSILON)
            j++;
    }
    return transactions;
};
exports.computeMinimumTransactions = computeMinimumTransactions;
// ============================================================
// CALCULATE SETTLEMENT
// ============================================================
/**
 * Calculate the current settlement plan for a trip.
 *
 * Flow:
 * 1. Load all unsettled expenses for the trip
 * 2. Compute net balance per member (in baseCurrency)
 * 3. Run min-transaction algorithm
 * 4. Upsert Settlement document
 */
const calculateSettlement = async (tripId, requestingUid) => {
    // Load trip
    const trip = await trip_model_1.Trip.findById(tripId);
    if (!trip)
        throw new AppError_1.AppError('Trip not found', 404);
    if (!trip.isMember(requestingUid)) {
        throw new AppError_1.AppError('You are not a member of this trip', 403);
    }
    // Load all unsettled expenses
    const expenses = await expense_model_1.Expense.find({
        tripId: new mongoose_1.Types.ObjectId(tripId),
        isSettled: false,
    }).lean();
    // Build member display name lookup
    const memberMap = new Map();
    trip.getActiveMembers().forEach((m) => {
        memberMap.set(m.userId, m.displayName);
    });
    // Compute net balance per member
    const balanceMap = new Map();
    // Initialize all active members at 0
    trip.getActiveMembers().forEach((m) => balanceMap.set(m.userId, 0));
    for (const expense of expenses) {
        let unpaidAmount = 0;
        // Each unpaid split debits the member
        for (const split of expense.splits) {
            if (!split.isPaid) {
                const current = balanceMap.get(split.userId) ?? 0;
                balanceMap.set(split.userId, current - split.amountBase);
                unpaidAmount += split.amountBase;
            }
        }
        // Payer gets credit ONLY for the total unpaid splits
        const currentPayer = balanceMap.get(expense.paidBy) ?? 0;
        balanceMap.set(expense.paidBy, currentPayer + unpaidAmount);
    }
    // Convert to NetBalance array
    const netBalances = Array.from(balanceMap.entries()).map(([userId, amount]) => ({
        userId,
        displayName: memberMap.get(userId) ?? 'Unknown',
        amount,
    }));
    // Run minimum transaction algorithm
    const minTransactions = (0, exports.computeMinimumTransactions)(netBalances);
    // Fetch recipients to get upiId for direct payup link
    const receiverIds = minTransactions.map((t) => t.to);
    const receivers = await auth_model_1.User.find({ _id: { $in: receiverIds } })
        .select('_id bankingDetails.upiId')
        .lean();
    const upiMap = new Map(receivers.map((r) => [r._id.toString(), r.bankingDetails?.upiId]));
    // Build settlement transaction documents
    const settlementTransactions = minTransactions.map((t) => {
        let upiDeepLink;
        const pa = upiMap.get(t.to);
        if (pa) {
            const pn = encodeURIComponent(t.toName);
            const am = t.amount.toFixed(2);
            const cu = trip.baseCurrency;
            const tn = encodeURIComponent('TripSplit Settlement');
            upiDeepLink = `upi://pay?pa=${encodeURIComponent(pa)}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;
        }
        return {
            from: t.from,
            fromName: t.fromName,
            to: t.to,
            toName: t.toName,
            amountBase: t.amount,
            baseCurrency: trip.baseCurrency,
            status: 'pending',
            upiDeepLink,
        };
    });
    // Upsert settlement (one per trip)
    const settlement = await settlement_model_1.Settlement.findOneAndUpdate({ tripId: new mongoose_1.Types.ObjectId(tripId) }, {
        tripId: new mongoose_1.Types.ObjectId(tripId),
        baseCurrency: trip.baseCurrency,
        transactions: settlementTransactions,
        totalTransactions: settlementTransactions.length,
        calculatedAt: new Date(),
        isStale: false,
    }, { upsert: true, new: true });
    return settlement;
};
exports.calculateSettlement = calculateSettlement;
// ============================================================
// GET SETTLEMENT
// ============================================================
/**
 * Get current settlement for a trip.
 * Auto-recalculates if missing or stale.
 */
const getSettlement = async (tripId, requestingUid) => {
    const existing = await settlement_model_1.Settlement.findOne({
        tripId: new mongoose_1.Types.ObjectId(tripId),
    });
    if (!existing || existing.isStale) {
        return (0, exports.calculateSettlement)(tripId, requestingUid);
    }
    return existing;
};
exports.getSettlement = getSettlement;
// ============================================================
// MARK STALE
// ============================================================
/**
 * Mark settlement as stale when expenses change.
 * Called by Expense service after create/update/delete.
 */
const markSettlementStale = async (tripId) => {
    await settlement_model_1.Settlement.findOneAndUpdate({ tripId: new mongoose_1.Types.ObjectId(tripId) }, { $set: { isStale: true } });
};
exports.markSettlementStale = markSettlementStale;
// ============================================================
// UPI PAYMENT FLOW
// ============================================================
/**
 * Initiate a UPI payment for a settlement transaction.
 * Generates UPI deep link and marks transaction as 'initiated'.
 *
 * UPI deep link format:
 * upi://pay?pa=vpa@bank&pn=Name&am=Amount&cu=INR&tn=Note
 */
const initiatePayment = async (tripId, transactionId, fromUid) => {
    const settlement = await settlement_model_1.Settlement.findOne({
        tripId: new mongoose_1.Types.ObjectId(tripId),
    });
    if (!settlement) {
        throw new AppError_1.AppError('No settlement found. Calculate settlement first.', 404);
    }
    const txn = settlement.transactions.find((t) => t._id.toString() === transactionId);
    if (!txn)
        throw new AppError_1.AppError('Transaction not found', 404);
    if (txn.from !== fromUid) {
        throw new AppError_1.AppError('This is not your payment to make', 403);
    }
    if (txn.status === 'confirmed') {
        throw new AppError_1.AppError('Payment already confirmed', 400);
    }
    // Get recipient's UPI ID
    const recipient = await auth_model_1.User.findOne({
        _id: txn.to,
        isActive: true,
        isDeleted: false,
    }).select('bankingDetails.upiId displayName').lean();
    if (!recipient?.bankingDetails?.upiId) {
        throw new AppError_1.AppError(`${txn.toName} has not set up their UPI ID yet`, 400);
    }
    // Build UPI deep link
    const pa = encodeURIComponent(recipient.bankingDetails.upiId);
    const pn = encodeURIComponent(txn.toName);
    const am = txn.amountBase.toFixed(2);
    const cu = txn.baseCurrency;
    const tn = encodeURIComponent('TripSplit Settlement');
    const upiDeepLink = `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;
    // Update transaction
    txn.status = 'initiated';
    txn.upiDeepLink = upiDeepLink;
    txn.initiatedAt = new Date();
    await settlement.save();
    socket_server_1.socketServer.notifySettlementRequest(txn.to, txn.fromName, txn.amountBase, txn.baseCurrency, tripId);
    return {
        transaction: txn,
        upiDeepLink,
    };
};
exports.initiatePayment = initiatePayment;
/**
 * Confirm receipt of a payment.
 * Only the recipient can confirm.
 * Marks all relevant expense splits as paid.
 */
const confirmPayment = async (tripId, transactionId, confirmingUid) => {
    const settlement = await settlement_model_1.Settlement.findOne({
        tripId: new mongoose_1.Types.ObjectId(tripId),
    });
    if (!settlement)
        throw new AppError_1.AppError('Settlement not found', 404);
    const txn = settlement.transactions.find((t) => t._id.toString() === transactionId);
    if (!txn)
        throw new AppError_1.AppError('Transaction not found', 404);
    if (txn.to !== confirmingUid) {
        throw new AppError_1.AppError('Only the recipient can confirm receipt', 403);
    }
    if (txn.status === 'confirmed') {
        throw new AppError_1.AppError('Payment already confirmed', 400);
    }
    if (txn.status === 'pending') {
        throw new AppError_1.AppError('Payment was never initiated', 400);
    }
    // Confirm the transaction
    txn.status = 'confirmed';
    txn.confirmedAt = new Date();
    // Mark all splits between these two users as paid
    // This handles the case where one settlement covers multiple expenses
    await expense_model_1.Expense.updateMany({
        tripId: new mongoose_1.Types.ObjectId(tripId),
        isSettled: false,
        'splits.userId': txn.from,
        paidBy: txn.to,
    }, {
        $set: {
            'splits.$[elem].isPaid': true,
            'splits.$[elem].paidAt': new Date(),
        },
    }, {
        arrayFilters: [{ 'elem.userId': txn.from, 'elem.isPaid': false }],
    });
    // Also handle the reverse: where the payer is the 'from' user
    await expense_model_1.Expense.updateMany({
        tripId: new mongoose_1.Types.ObjectId(tripId),
        isSettled: false,
        paidBy: txn.from,
        'splits.userId': txn.to,
    }, {
        $set: {
            'splits.$[elem].isPaid': true,
            'splits.$[elem].paidAt': new Date(),
        },
    }, {
        arrayFilters: [{ 'elem.userId': txn.to, 'elem.isPaid': false }],
    });
    // Update isSettled on fully-settled expenses
    const affectedExpenses = await expense_model_1.Expense.find({
        tripId: new mongoose_1.Types.ObjectId(tripId),
        isSettled: false,
    });
    for (const expense of affectedExpenses) {
        if (expense.splits.every((s) => s.isPaid)) {
            expense.isSettled = true;
            await expense.save();
        }
    }
    await settlement.save();
    socket_server_1.socketServer.notifySettlementCompleted(txn.from, txn.to, txn.amountBase, txn.baseCurrency, tripId);
    return settlement;
};
exports.confirmPayment = confirmPayment;
/**
 * Dispute a payment.
 * Either participant can dispute.
 */
const disputePayment = async (tripId, transactionId, requestingUid) => {
    const settlement = await settlement_model_1.Settlement.findOne({
        tripId: new mongoose_1.Types.ObjectId(tripId),
    });
    if (!settlement)
        throw new AppError_1.AppError('Settlement not found', 404);
    const txn = settlement.transactions.find((t) => t._id.toString() === transactionId);
    if (!txn)
        throw new AppError_1.AppError('Transaction not found', 404);
    const isParticipant = txn.from === requestingUid || txn.to === requestingUid;
    if (!isParticipant) {
        throw new AppError_1.AppError('You are not part of this transaction', 403);
    }
    if (txn.status === 'disputed') {
        throw new AppError_1.AppError('Transaction is already disputed', 400);
    }
    txn.status = 'disputed';
    await settlement.save();
    return settlement;
};
exports.disputePayment = disputePayment;
// ============================================================
// EXPORT ALL AS NAMESPACE
// ============================================================
exports.settlementService = {
    calculateSettlement: exports.calculateSettlement,
    getSettlement: exports.getSettlement,
    markSettlementStale: exports.markSettlementStale,
    initiatePayment: exports.initiatePayment,
    confirmPayment: exports.confirmPayment,
    disputePayment: exports.disputePayment,
    computeMinimumTransactions: exports.computeMinimumTransactions,
};
//# sourceMappingURL=settlement.service.js.map
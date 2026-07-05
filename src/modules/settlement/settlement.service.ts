import { Types } from 'mongoose';
import {
  Settlement,
  ISettlement,
  ISettlementTransaction,
} from './settlement.model';
import { Expense } from '../expense/expense.model';
import { Trip } from '../trips/trip.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { achievementService } from '../achievement/achievement.service';
import { logger } from '../../config/logger';

// ============================================================
// TYPES
// ============================================================

interface NetBalance {
  userId: string;
  displayName: string;
  amount: number; // Positive = creditor (owed money), Negative = debtor (owes money)
}

interface MinTransaction {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

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
export const computeMinimumTransactions = (
  balances: NetBalance[]
): MinTransaction[] => {
  const EPSILON = 0.01;

  const creditors = balances
    .filter((b) => b.amount > EPSILON)
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((b) => b.amount < -EPSILON)
    .map((b) => ({ ...b, amount: -b.amount }))
    .sort((a, b) => b.amount - a.amount);

  const transactions: MinTransaction[] = [];
  let i = 0;
  let j = 0;

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

    if (creditors[i].amount < EPSILON) i++;
    if (debtors[j].amount < EPSILON) j++;
  }

  return transactions;
};

// ============================================================
// CALCULATE SETTLEMENT
// ============================================================

export const calculateSettlement = async (
  tripId: string,
  requestingUid: string
): Promise<ISettlement> => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new AppError('Trip not found', 404);
  if (!trip.isMember(requestingUid)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  // Load all unsettled, non-archived expenses
  const expenses = await Expense.find({
    tripId: new Types.ObjectId(tripId),
    isSettled: false,
    isArchived: false,
  }).lean();

  // Build member display name lookup
  const memberMap = new Map<string, string>();
  trip.getActiveMembers().forEach((m) => {
    memberMap.set(m.userId, m.displayName);
  });

  // Compute net balance per member
  const balanceMap = new Map<string, number>();
  trip.getActiveMembers().forEach((m) => balanceMap.set(m.userId, 0));

  // Track expense→member relationships for explanation generation
  const debtExplanations = new Map<string, Map<string, number>>();

  for (const expense of expenses) {
    let unpaidAmount = 0;

    for (const split of expense.splits) {
      if (!split.isPaid) {
        const current = balanceMap.get(split.userId) ?? 0;
        balanceMap.set(split.userId, current - split.amountBase);
        unpaidAmount += split.amountBase;

        // Track who owes whom at the expense level
        if (!debtExplanations.has(split.userId)) {
          debtExplanations.set(split.userId, new Map());
        }
        const payerDebt = debtExplanations.get(split.userId)!;
        payerDebt.set(
          expense.paidBy,
          (payerDebt.get(expense.paidBy) ?? 0) + split.amountBase
        );
      }
    }

    const currentPayer = balanceMap.get(expense.paidBy) ?? 0;
    balanceMap.set(expense.paidBy, currentPayer + unpaidAmount);
  }

  // Convert to NetBalance array
  const netBalances: NetBalance[] = Array.from(balanceMap.entries()).map(
    ([userId, amount]) => ({
      userId,
      displayName: memberMap.get(userId) ?? 'Unknown',
      amount,
    })
  );

  // Run minimum transaction algorithm
  const minTransactions = computeMinimumTransactions(netBalances);

  // Get UPI IDs for all recipients
  const receiverIds = minTransactions.map((t) => t.to);
  const receivers = await User.find({
    firebaseUid: { $in: receiverIds },
    isActive: true,
    isDeleted: false,
  })
    .select('firebaseUid bankingDetails.upiId displayName')
    .lean();
  const upiMap = new Map(
    receivers.map((r: any) => [r.firebaseUid, r.bankingDetails?.upiId])
  );

  // Preserve lifecycle state for existing transactions
  const existingSettlement = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  }).lean();
  const existingByPair = new Map<string, ISettlementTransaction>();
  if (existingSettlement) {
    for (const t of existingSettlement.transactions) {
      existingByPair.set(`${t.from}:${t.to}`, t);
    }
  }

  // Build settlement transactions with explanations
  const settlementTransactions = minTransactions.map((t) => {
    const prior = existingByPair.get(`${t.from}:${t.to}`);

    // Generate explanation for this netted transaction
    const explanation = generateTransactionExplanation(
      t.from,
      t.fromName,
      t.to,
      t.toName,
      debtExplanations
    );

    if (prior && prior.status !== 'pending') {
      return {
        from: t.from,
        fromName: t.fromName,
        to: t.to,
        toName: t.toName,
        amountBase: t.amount,
        baseCurrency: trip.baseCurrency,
        status: prior.status,
        upiDeepLink: prior.upiDeepLink,
        paymentId: prior.paymentId,
        initiatedAt: prior.initiatedAt,
        confirmedAt: prior.confirmedAt,
        disputedAt: prior.disputedAt,
        disputedBy: prior.disputedBy,
        disputeReason: prior.disputeReason,
        explanation,
      };
    }

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
      status: 'pending' as const,
      upiDeepLink,
      explanation,
    };
  });

  // Upsert settlement
  const settlement = await Settlement.findOneAndUpdate(
    { tripId: new Types.ObjectId(tripId) },
    {
      tripId: new Types.ObjectId(tripId),
      baseCurrency: trip.baseCurrency,
      transactions: settlementTransactions,
      calculatedAt: new Date(),
      isStale: false,
      $push: {
        history: {
          action: 'calculated',
          actorUid: requestingUid,
          timestamp: new Date(),
          metadata: {
            transactionCount: settlementTransactions.length,
            totalAmount: settlementTransactions.reduce((s, t) => s + t.amountBase, 0),
          },
        },
      },
    },
    { upsert: true, new: true }
  );

  // Notify all members
  socketServer.notifySettlementCalculated(
    tripId,
    settlementTransactions.length,
    trip.baseCurrency
  );

  return settlement;
};

// ============================================================
// GET SETTLEMENT
// ============================================================

export const getSettlement = async (
  tripId: string,
  requestingUid: string
): Promise<ISettlement> => {
  const existing = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  });

  if (!existing || existing.isStale) {
    return calculateSettlement(tripId, requestingUid);
  }

  return existing;
};

// ============================================================
// MARK STALE
// ============================================================

export const markSettlementStale = async (tripId: string): Promise<void> => {
  await Settlement.findOneAndUpdate(
    { tripId: new Types.ObjectId(tripId) },
    { $set: { isStale: true } }
  );
};

// ============================================================
// GET SETTLEMENT SUMMARY (DASHBOARD WIDGET)
// ============================================================

export const getSettlementSummary = async (
  tripId: string,
  requestingUid: string
) => {
  const settlement = await getSettlement(tripId, requestingUid);

  const yourTransactions = settlement.transactions.filter(
    (t) => t.from === requestingUid || t.to === requestingUid
  );

  const youOwe = yourTransactions
    .filter((t) => t.from === requestingUid && t.status !== 'confirmed')
    .map((t) => ({
      to: t.to,
      toName: t.toName,
      amount: t.amountBase,
      status: t.status,
      upiDeepLink: t.upiDeepLink,
      transactionId: (t as any)._id,
    }));

  const owedToYou = yourTransactions
    .filter((t) => t.to === requestingUid && t.status !== 'confirmed')
    .map((t) => ({
      from: t.from,
      fromName: t.fromName,
      amount: t.amountBase,
      status: t.status,
      transactionId: (t as any)._id,
    }));

  const netBalance =
    owedToYou.reduce((s, t) => s + t.amount, 0) -
    youOwe.reduce((s, t) => s + t.amount, 0);

  // Find the next suggested payment (largest you-owe transaction)
  const nextSuggestedPayment =
    youOwe.length > 0
      ? youOwe.sort((a, b) => b.amount - a.amount)[0]
      : null;

  return {
    baseCurrency: settlement.baseCurrency,
    totalTransactions: settlement.totalTransactions,
    totalAmount: settlement.totalAmount,
    confirmedAmount: settlement.transactions
      .filter((t) => t.status === 'confirmed')
      .reduce((s, t) => s + t.amountBase, 0),
    pendingAmount: settlement.transactions
      .filter((t) => t.status === 'pending')
      .reduce((s, t) => s + t.amountBase, 0),
    settlementProgress: settlement.settlementProgress,
    isFullySettled: settlement.isFullySettled,
    yourPosition: {
      youOwe,
      owedToYou,
      netBalance,
      nextSuggestedPayment,
    },
    lastCalculated: settlement.calculatedAt,
    isStale: settlement.isStale,
  };
};

// ============================================================
// UPI PAYMENT FLOW
// ============================================================

export const initiatePayment = async (
  tripId: string,
  transactionId: string,
  fromUid: string,
  partialAmount?: number
): Promise<{ transaction: ISettlementTransaction; upiDeepLink: string }> => {
  const settlement = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  });

  if (!settlement) {
    throw new AppError(
      'No settlement found. Calculate settlement first.',
      404
    );
  }

  const txn = settlement.transactions.find(
    (t) => (t as any)._id.toString() === transactionId
  );

  if (!txn) throw new AppError('Transaction not found', 404);
  if (txn.from !== fromUid) {
    throw new AppError('This is not your payment to make', 403);
  }
  if (txn.status === 'confirmed') {
    throw new AppError('Payment already confirmed', 400);
  }

  const recipient = await User.findOne({
    firebaseUid: txn.to,
    isActive: true,
    isDeleted: false,
  })
    .select('bankingDetails.upiId displayName')
    .lean();

  if (!recipient?.bankingDetails?.upiId) {
    throw new AppError(
      `${txn.toName} has not set up their UPI ID yet`,
      400
    );
  }

  const paymentAmount = partialAmount ?? txn.amountBase;

  // Build UPI deep link
  const pa = encodeURIComponent(recipient.bankingDetails.upiId);
  const pn = encodeURIComponent(txn.toName);
  const am = paymentAmount.toFixed(2);
  const cu = txn.baseCurrency;
  const tn = encodeURIComponent('TripSplit Settlement');
  const upiDeepLink = `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;

  // Update transaction
  txn.status = 'initiated';
  txn.upiDeepLink = upiDeepLink;
  txn.initiatedAt = new Date();

  settlement.history.push({
    action: 'payment_initiated',
    actorUid: fromUid,
    transactionId: (txn as any)._id,
    amount: paymentAmount,
    timestamp: new Date(),
    metadata: { partial: !!partialAmount },
  });

  await settlement.save();

  socketServer.notifySettlementRequest(
    txn.to,
    txn.fromName,
    paymentAmount,
    txn.baseCurrency,
    tripId
  );

  return {
    transaction: txn,
    upiDeepLink,
  };
};

// ============================================================
// CONFIRM PAYMENT
// ============================================================

export const confirmPayment = async (
  tripId: string,
  transactionId: string,
  confirmingUid: string,
  notes?: string
): Promise<ISettlement> => {
  const settlement = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  });

  if (!settlement) throw new AppError('Settlement not found', 404);

  const txn = settlement.transactions.find(
    (t) => (t as any)._id.toString() === transactionId
  );

  if (!txn) throw new AppError('Transaction not found', 404);
  if (txn.to !== confirmingUid) {
    throw new AppError('Only the recipient can confirm receipt', 403);
  }
  if (txn.status === 'confirmed') {
    throw new AppError('Payment already confirmed', 400);
  }
  if (txn.status === 'pending') {
    throw new AppError('Payment was never initiated', 400);
  }

  // Confirm the transaction
  txn.status = 'confirmed';
  txn.confirmedAt = new Date();

  settlement.history.push({
    action: 'payment_confirmed',
    actorUid: confirmingUid,
    transactionId: (txn as any)._id,
    amount: txn.amountBase,
    timestamp: new Date(),
    metadata: { notes },
  });

  // Mark all splits between these two users as paid
  await Expense.updateMany(
    {
      tripId: new Types.ObjectId(tripId),
      isSettled: false,
      'splits.userId': txn.from,
      paidBy: txn.to,
    },
    {
      $set: {
        'splits.$[elem].isPaid': true,
        'splits.$[elem].paidAt': new Date(),
      },
    },
    {
      arrayFilters: [{ 'elem.userId': txn.from, 'elem.isPaid': false }],
    }
  );

  // Also handle reverse direction
  await Expense.updateMany(
    {
      tripId: new Types.ObjectId(tripId),
      isSettled: false,
      paidBy: txn.from,
      'splits.userId': txn.to,
    },
    {
      $set: {
        'splits.$[elem].isPaid': true,
        'splits.$[elem].paidAt': new Date(),
      },
    },
    {
      arrayFilters: [{ 'elem.userId': txn.to, 'elem.isPaid': false }],
    }
  );

  // Bulk update isSettled on fully-settled expenses
  const affectedExpenses = await Expense.find({
    tripId: new Types.ObjectId(tripId),
    isSettled: false,
  });

  const toUpdate = affectedExpenses.filter((e) =>
    e.splits.every((s) => s.isPaid)
  );

  if (toUpdate.length > 0) {
    await Expense.bulkWrite(
      toUpdate.map((e) => ({
        updateOne: {
          filter: { _id: e._id },
          update: { $set: { isSettled: true } },
        },
      }))
    );
  }

  await settlement.save();

  socketServer.notifySettlementCompleted(
    txn.from,
    txn.to,
    txn.amountBase,
    txn.baseCurrency,
    tripId
  );

  // If fully settled, notify all members
  if (settlement.isFullySettled) {
    socketServer.notifyTripFullySettled(tripId);
  }
  
  achievementService.onSettlementConfirmed(tripId, txn.from, txn.to).catch(err => {
    logger.error('Failed to process achievements on settlement confirmed:', err);
  });

  return settlement;
};

// ============================================================
// DISPUTE PAYMENT
// ============================================================

export const disputePayment = async (
  tripId: string,
  transactionId: string,
  requestingUid: string,
  reason: string
): Promise<ISettlement> => {
  const settlement = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  });

  if (!settlement) throw new AppError('Settlement not found', 404);

  const txn = settlement.transactions.find(
    (t) => (t as any)._id.toString() === transactionId
  );

  if (!txn) throw new AppError('Transaction not found', 404);

  const isParticipant =
    txn.from === requestingUid || txn.to === requestingUid;
  if (!isParticipant) {
    throw new AppError('You are not part of this transaction', 403);
  }

  if (txn.status === 'disputed') {
    throw new AppError('Transaction is already disputed', 400);
  }

  txn.status = 'disputed';
  txn.disputedAt = new Date();
  txn.disputedBy = requestingUid;
  txn.disputeReason = reason;

  settlement.history.push({
    action: 'payment_disputed',
    actorUid: requestingUid,
    transactionId: (txn as any)._id,
    amount: txn.amountBase,
    timestamp: new Date(),
    metadata: { reason },
  });

  await settlement.save();

  // Notify the other party + trip admins
  const otherParty = txn.from === requestingUid ? txn.to : txn.from;
  socketServer.notifySettlementDisputed(
    otherParty,
    tripId,
    txn.amountBase,
    txn.baseCurrency,
    reason
  );

  return settlement;
};

// ============================================================
// RETRY PAYMENT (Regenerate UPI link)
// ============================================================

export const retryPayment = async (
  tripId: string,
  transactionId: string,
  fromUid: string
): Promise<{ transaction: ISettlementTransaction; upiDeepLink: string }> => {
  const settlement = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  });

  if (!settlement) {
    throw new AppError('No settlement found', 404);
  }

  const txn = settlement.transactions.find(
    (t) => (t as any)._id.toString() === transactionId
  );

  if (!txn) throw new AppError('Transaction not found', 404);
  if (txn.from !== fromUid) {
    throw new AppError('This is not your payment to make', 403);
  }
  if (txn.status === 'confirmed') {
    throw new AppError('Payment already confirmed', 400);
  }

  // Regenerate UPI link
  const recipient = await User.findOne({
    firebaseUid: txn.to,
    isActive: true,
    isDeleted: false,
  })
    .select('bankingDetails.upiId displayName')
    .lean();

  if (!recipient?.bankingDetails?.upiId) {
    throw new AppError(
      `${txn.toName} has not set up their UPI ID yet`,
      400
    );
  }

  const pa = encodeURIComponent(recipient.bankingDetails.upiId);
  const pn = encodeURIComponent(txn.toName);
  const am = txn.amountBase.toFixed(2);
  const cu = txn.baseCurrency;
  const tn = encodeURIComponent('TripSplit Settlement');
  const upiDeepLink = `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;

  txn.status = 'initiated';
  txn.upiDeepLink = upiDeepLink;
  txn.initiatedAt = new Date();
  // Clear dispute info
  txn.disputedAt = undefined;
  txn.disputedBy = undefined;
  txn.disputeReason = undefined;

  settlement.history.push({
    action: 'payment_retried',
    actorUid: fromUid,
    transactionId: (txn as any)._id,
    amount: txn.amountBase,
    timestamp: new Date(),
  });

  await settlement.save();

  socketServer.notifySettlementRequest(
    txn.to,
    txn.fromName,
    txn.amountBase,
    txn.baseCurrency,
    tripId
  );

  return {
    transaction: txn,
    upiDeepLink,
  };
};

// ============================================================
// GET MY SETTLEMENTS (ACROSS ALL TRIPS)
// ============================================================

export const getMySettlements = async (
  userId: string,
  status?: string
) => {
  const query: any = {
    $or: [
      { 'transactions.from': userId },
      { 'transactions.to': userId },
    ],
  };

  const settlements = await Settlement.find(query)
    .populate('tripId', 'title')
    .lean();

  const myTransactions = settlements.flatMap((s: any) =>
    s.transactions
      .filter(
        (t: any) =>
          (t.from === userId || t.to === userId) &&
          (!status || t.status === status)
      )
      .map((t: any) => ({
        ...t,
        tripId: s.tripId,
        tripTitle: s.tripId?.title,
        settlementId: s._id,
      }))
  );

  return {
    transactions: myTransactions,
    summary: {
      totalPending: myTransactions.filter((t) => t.status === 'pending').length,
      totalInitiated: myTransactions.filter((t) => t.status === 'initiated')
        .length,
      totalConfirmed: myTransactions.filter((t) => t.status === 'confirmed')
        .length,
      totalDisputed: myTransactions.filter((t) => t.status === 'disputed')
        .length,
      totalOwed: myTransactions
        .filter((t) => t.from === userId && t.status !== 'confirmed')
        .reduce((s, t) => s + t.amountBase, 0),
      totalReceivable: myTransactions
        .filter((t) => t.to === userId && t.status !== 'confirmed')
        .reduce((s, t) => s + t.amountBase, 0),
    },
  };
};

// ============================================================
// EXPORT SETTLEMENT AS JSON/CSV
// ============================================================

export const exportSettlement = async (
  tripId: string,
  requestingUid: string,
  format: 'json' | 'csv' = 'json'
) => {
  const settlement = await getSettlement(tripId, requestingUid);
  const trip = await Trip.findById(tripId).select('title').lean();

  const exportData = {
    tripName: trip?.title,
    baseCurrency: settlement.baseCurrency,
    calculatedAt: settlement.calculatedAt,
    transactions: settlement.transactions.map((t) => ({
      from: t.fromName,
      to: t.toName,
      amount: t.amountBase,
      currency: t.baseCurrency,
      status: t.status,
      upiLink: t.upiDeepLink || null,
    })),
    summary: {
      totalTransactions: settlement.totalTransactions,
      totalAmount: settlement.totalAmount,
      pendingCount: settlement.pendingCount,
      confirmedCount: settlement.confirmedCount,
      isFullySettled: settlement.isFullySettled,
    },
  };

  if (format === 'csv') {
    const headers = 'From,To,Amount,Currency,Status,UPI Link\n';
    const rows = exportData.transactions
      .map(
        (t) =>
          `"${t.from}","${t.to}",${t.amount},${t.currency},${t.status},${t.upiLink || ''}`
      )
      .join('\n');
    return headers + rows;
  }

  return exportData;
};

// ============================================================
// GET SETTLEMENT HISTORY
// ============================================================

export const getSettlementHistory = async (
  tripId: string,
  requestingUid: string
) => {
  const settlement = await getSettlement(tripId, requestingUid);
  
  return [...settlement.history].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
};

// ============================================================
// PRIVATE HELPERS
// ============================================================

/**
 * Generate human-readable explanation for why a netted transaction exists.
 * Helps users understand why they're paying someone they may not have
 * directly split an expense with.
 */
function generateTransactionExplanation(
  fromUid: string,
  fromName: string,
  toUid: string,
  toName: string,
  debtExplanations: Map<string, Map<string, number>>
): string[] {
  const explanations: string[] = [];

  // Direct debt: fromUid owes toUid
  const directDebt = debtExplanations.get(fromUid)?.get(toUid);
  if (directDebt) {
    explanations.push(
      `${fromName} owes ${toName} ${directDebt.toFixed(2)} directly from shared expenses`
    );
  }

  // Check for indirect via other members (multi-hop explanation)
  for (const [intermediaryId, debts] of debtExplanations.entries()) {
    if (intermediaryId === fromUid || intermediaryId === toUid) continue;

    const fromOwesIntermediary = debtExplanations.get(fromUid)?.get(intermediaryId);
    const intermediaryOwesTo = debtExplanations.get(intermediaryId)?.get(toUid);

    if (fromOwesIntermediary && intermediaryOwesTo) {
      const intermediaryName =
        Array.from(debtExplanations.keys()).find(() => true) || 'another member';
      explanations.push(
        `${fromName} → intermediary → ${toName} (netted through common connections)`
      );
    }
  }

  if (explanations.length === 0) {
    explanations.push(
      `Netted settlement: ${fromName} pays ${toName} to minimize total transfers`
    );
  }

  return explanations;
}

// ============================================================
// NAMESPACE EXPORT
// ============================================================

export const settlementService = {
  calculateSettlement,
  getSettlement,
  getSettlementSummary,
  markSettlementStale,
  initiatePayment,
  confirmPayment,
  disputePayment,
  retryPayment,
  getMySettlements,
  exportSettlement,
  computeMinimumTransactions,
  getSettlementHistory,
};




// import { Types } from 'mongoose';
// import { Settlement, ISettlement, ISettlementTransaction } from './settlement.model';
// import { Expense } from '../expense/expense.model';
// import { Trip } from '../trips/trip.model';
// import { User } from '../auth/auth.model';
// import { AppError } from '../../shared/errors/AppError';
// import { socketServer } from '../../infrastructure/websocket/socket.server';

// // ============================================================
// // TYPES
// // ============================================================

// interface NetBalance {
//   userId: string;
//   displayName: string;
//   amount: number; // Positive = creditor (owed money), Negative = debtor (owes money)
// }

// interface MinTransaction {
//   from: string;
//   fromName: string;
//   to: string;
//   toName: string;
//   amount: number;
// }

// // ============================================================
// // MINIMUM TRANSACTION ALGORITHM
// // ============================================================

// /**
//  * Greedy minimum-transaction settlement algorithm.
//  *
//  * For N people: max N-1 transfers (instead of O(N²) naive).
//  * Example: 8 friends, 47 expenses → max 7 transfers.
//  *
//  * Algorithm:
//  * 1. Compute net balance per person
//  * 2. Split into creditors (+) and debtors (-)
//  * 3. Greedily match largest creditor with largest debtor
//  */
// export const computeMinimumTransactions = (
//   balances: NetBalance[]
// ): MinTransaction[] => {
//   const EPSILON = 0.01; // Ignore balances below 1 paisa

//   // Creditors: people who are OWED money (positive balance)
//   const creditors = balances
//     .filter((b) => b.amount > EPSILON)
//     .sort((a, b) => b.amount - a.amount);

//   // Debtors: people who OWE money (negative balance → flip to positive)
//   const debtors = balances
//     .filter((b) => b.amount < -EPSILON)
//     .map((b) => ({ ...b, amount: -b.amount }))
//     .sort((a, b) => b.amount - a.amount);

//   const transactions: MinTransaction[] = [];
//   let i = 0; // Creditor index
//   let j = 0; // Debtor index

//   while (i < creditors.length && j < debtors.length) {
//     const settleAmount = Math.min(creditors[i].amount, debtors[j].amount);
//     const rounded = parseFloat(settleAmount.toFixed(2));

//     if (rounded > 0) {
//       transactions.push({
//         from: debtors[j].userId,
//         fromName: debtors[j].displayName,
//         to: creditors[i].userId,
//         toName: creditors[i].displayName,
//         amount: rounded,
//       });
//     }

//     creditors[i].amount -= settleAmount;
//     debtors[j].amount -= settleAmount;

//     if (creditors[i].amount < EPSILON) i++;
//     if (debtors[j].amount < EPSILON) j++;
//   }

//   return transactions;
// };

// // ============================================================
// // CALCULATE SETTLEMENT
// // ============================================================

// /**
//  * Calculate the current settlement plan for a trip.
//  *
//  * Flow:
//  * 1. Load all unsettled, non-archived expenses for the trip
//  * 2. Compute net balance per member (in baseCurrency)
//  * 3. Run min-transaction algorithm
//  * 4. Upsert Settlement document — preserving in-flight transaction status
//  *    for any (from, to) pair that already exists, so an unrelated new
//  *    expense elsewhere in the trip doesn't wipe out someone's already-
//  *    initiated or confirmed payment.
//  */
// export const calculateSettlement = async (
//   tripId: string,
//   requestingUid: string
// ): Promise<ISettlement> => {
//   // Load trip
//   const trip = await Trip.findById(tripId);
//   if (!trip) throw new AppError('Trip not found', 404);
//   if (!trip.isMember(requestingUid)) {
//     throw new AppError('You are not a member of this trip', 403);
//   }

//   // Load all unsettled expenses
//   // FIX: archived expenses were previously included here — an expense that
//   // was soft-deleted (isArchived: true) but happened to be isSettled: false
//   // at the time of archiving would keep contributing debt to everyone's
//   // balance forever.
//   const expenses = await Expense.find({
//     tripId: new Types.ObjectId(tripId),
//     isSettled: false,
//     isArchived: false,
//   }).lean();

//   // Build member display name lookup
//   const memberMap = new Map<string, string>();
//   trip.getActiveMembers().forEach((m) => {
//     memberMap.set(m.userId, m.displayName);
//   });

//   // Compute net balance per member
//   const balanceMap = new Map<string, number>();

//   // Initialize all active members at 0
//   trip.getActiveMembers().forEach((m) => balanceMap.set(m.userId, 0));

//   for (const expense of expenses) {
//     let unpaidAmount = 0;

//     // Each unpaid split debits the member
//     for (const split of expense.splits) {
//       if (!split.isPaid) {
//         const current = balanceMap.get(split.userId) ?? 0;
//         balanceMap.set(split.userId, current - split.amountBase);
//         unpaidAmount += split.amountBase;
//       }
//     }

//     // Payer gets credit ONLY for the total unpaid splits
//     const currentPayer = balanceMap.get(expense.paidBy) ?? 0;
//     balanceMap.set(expense.paidBy, currentPayer + unpaidAmount);
//   }

//   // Convert to NetBalance array
//   const netBalances: NetBalance[] = Array.from(balanceMap.entries()).map(
//     ([userId, amount]) => ({
//       userId,
//       displayName: memberMap.get(userId) ?? 'Unknown',
//       amount,
//     })
//   );

//   // Run minimum transaction algorithm
//   const minTransactions = computeMinimumTransactions(netBalances);

//   // FIX: was querying User by `_id`, but `to`/`from` here are Firebase UIDs
//   // (same convention as Expense.paidBy / splits.userId), while User._id is
//   // a separate generated UUID. This meant upiMap was always empty and no
//   // UPI deep link was ever attached. Query by `firebaseUid` instead.
//   const receiverIds = minTransactions.map((t) => t.to);
//   const receivers = await User.find({
//     firebaseUid: { $in: receiverIds },
//     isActive: true,
//     isDeleted: false,
//   })
//     .select('firebaseUid bankingDetails.upiId')
//     .lean();
//   const upiMap = new Map(
//     receivers.map((r: any) => [r.firebaseUid, r.bankingDetails?.upiId])
//   );

//   // Preserve lifecycle state for transactions between the same (from, to)
//   // pair across recalculations. Without this, ANY expense change in the
//   // trip (even one unrelated to a given pair) would blow away an
//   // already-initiated/confirmed/disputed transaction and reset it to
//   // 'pending', since the whole array is replaced on every recalculation.
//   //
//   // NOTE: this is a pair-level match, not an expense-level one. Because the
//   // min-transaction algorithm can reroute debt (A owes B, B owes C → a
//   // single A→C transfer), a transaction confirmed under one net-graph shape
//   // may not reappear as the same pair after a recalculation triggered by
//   // unrelated changes. This mitigates the common case (unrelated expense
//   // added elsewhere) but doesn't fully solve reconciliation under
//   // rerouting — see confirmPayment() below for more on that limitation.
//   const existingSettlement = await Settlement.findOne({
//     tripId: new Types.ObjectId(tripId),
//   }).lean();
//   const existingByPair = new Map<string, ISettlementTransaction>();
//   if (existingSettlement) {
//     for (const t of existingSettlement.transactions) {
//       existingByPair.set(`${t.from}:${t.to}`, t);
//     }
//   }

//   // Build settlement transaction documents
//   const settlementTransactions = minTransactions.map((t) => {
//     const prior = existingByPair.get(`${t.from}:${t.to}`);

//     if (prior && prior.status !== 'pending') {
//       // Carry forward everything except the freshly-computed amount stays
//       // as-is; if the recomputed amount differs meaningfully from what was
//       // already initiated/confirmed, that's worth surfacing to the user,
//       // but we don't silently discard their payment progress.
//       return {
//         from: t.from,
//         fromName: t.fromName,
//         to: t.to,
//         toName: t.toName,
//         amountBase: t.amount,
//         baseCurrency: trip.baseCurrency,
//         status: prior.status,
//         upiDeepLink: prior.upiDeepLink,
//         paymentId: prior.paymentId,
//         initiatedAt: prior.initiatedAt,
//         confirmedAt: prior.confirmedAt,
//       };
//     }

//     let upiDeepLink;
//     const pa = upiMap.get(t.to);
//     if (pa) {
//       const pn = encodeURIComponent(t.toName);
//       const am = t.amount.toFixed(2);
//       const cu = trip.baseCurrency;
//       const tn = encodeURIComponent('TripSplit Settlement');
//       upiDeepLink = `upi://pay?pa=${encodeURIComponent(pa)}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;
//     }

//     return {
//       from: t.from,
//       fromName: t.fromName,
//       to: t.to,
//       toName: t.toName,
//       amountBase: t.amount,
//       baseCurrency: trip.baseCurrency,
//       status: 'pending' as const,
//       upiDeepLink,
//     };
//   });

//   // Upsert settlement (one per trip)
//   const settlement = await Settlement.findOneAndUpdate(
//     { tripId: new Types.ObjectId(tripId) },
//     {
//       tripId: new Types.ObjectId(tripId),
//       baseCurrency: trip.baseCurrency,
//       transactions: settlementTransactions,
//       totalTransactions: settlementTransactions.length,
//       calculatedAt: new Date(),
//       isStale: false,
//     },
//     { upsert: true, new: true }
//   );

//   return settlement;
// };

// // ============================================================
// // GET SETTLEMENT
// // ============================================================

// /**
//  * Get current settlement for a trip.
//  * Auto-recalculates if missing or stale.
//  */
// export const getSettlement = async (
//   tripId: string,
//   requestingUid: string
// ): Promise<ISettlement> => {
//   const existing = await Settlement.findOne({
//     tripId: new Types.ObjectId(tripId),
//   });

//   if (!existing || existing.isStale) {
//     return calculateSettlement(tripId, requestingUid);
//   }

//   return existing;
// };

// // ============================================================
// // MARK STALE
// // ============================================================

// /**
//  * Mark settlement as stale when expenses change.
//  * Called by Expense service after create/update/delete.
//  */
// export const markSettlementStale = async (tripId: string): Promise<void> => {
//   await Settlement.findOneAndUpdate(
//     { tripId: new Types.ObjectId(tripId) },
//     { $set: { isStale: true } }
//   );
// };

// // ============================================================
// // UPI PAYMENT FLOW
// // ============================================================

// /**
//  * Initiate a UPI payment for a settlement transaction.
//  * Generates UPI deep link and marks transaction as 'initiated'.
//  *
//  * UPI deep link format:
//  * upi://pay?pa=vpa@bank&pn=Name&am=Amount&cu=INR&tn=Note
//  */
// export const initiatePayment = async (
//   tripId: string,
//   transactionId: string,
//   fromUid: string
// ): Promise<{ transaction: ISettlementTransaction; upiDeepLink: string }> => {
//   const settlement = await Settlement.findOne({
//     tripId: new Types.ObjectId(tripId),
//   });

//   if (!settlement) {
//     throw new AppError('No settlement found. Calculate settlement first.', 404);
//   }

//   const txn = settlement.transactions.find(
//     (t) => (t as any)._id.toString() === transactionId
//   );

//   if (!txn) throw new AppError('Transaction not found', 404);
//   if (txn.from !== fromUid) {
//     throw new AppError('This is not your payment to make', 403);
//   }
//   if (txn.status === 'confirmed') {
//     throw new AppError('Payment already confirmed', 400);
//   }

//   // FIX: was querying by `_id: txn.to`, but txn.to is a Firebase UID, not
//   // the User document's _id. This always returned null, meaning the
//   // "has not set up their UPI ID yet" error fired for everyone regardless
//   // of whether they'd actually configured one. Query by `firebaseUid`.
//   const recipient = await User.findOne({
//     firebaseUid: txn.to,
//     isActive: true,
//     isDeleted: false,
//   }).select('bankingDetails.upiId displayName').lean();

//   if (!recipient?.bankingDetails?.upiId) {
//     throw new AppError(
//       `${txn.toName} has not set up their UPI ID yet`,
//       400
//     );
//   }

//   // Build UPI deep link
//   const pa = encodeURIComponent(recipient.bankingDetails.upiId);
//   const pn = encodeURIComponent(txn.toName);
//   const am = txn.amountBase.toFixed(2);
//   const cu = txn.baseCurrency;
//   const tn = encodeURIComponent('TripSplit Settlement');
//   const upiDeepLink = `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;

//   // Update transaction
//   txn.status = 'initiated';
//   txn.upiDeepLink = upiDeepLink;
//   txn.initiatedAt = new Date();

//   await settlement.save();

//   socketServer.notifySettlementRequest(txn.to, txn.fromName, txn.amountBase, txn.baseCurrency, tripId);

//   return {
//     transaction: txn,
//     upiDeepLink,
//   };
// };

// /**
//  * Confirm receipt of a payment.
//  * Only the recipient can confirm.
//  * Marks all relevant expense splits as paid.
//  *
//  * KNOWN LIMITATION: this settlement transaction is a *netted* transfer
//  * from the minimum-transaction algorithm, not necessarily a direct debt
//  * from an original expense. If the algorithm rerouted debt through a third
//  * person (A owes B, B owes C → a single A→C transfer), there may be no
//  * expense where `paidBy: to` and `splits.userId: from` (or vice versa)
//  * exist at all — the updateMany calls below will simply match nothing,
//  * and the underlying Expense.isSettled state will drift from the
//  * Settlement's view of "confirmed". This works correctly for the common
//  * 2-person-debt case but isn't a full reconciliation. A more robust fix is
//  * to record confirmed settlement payments as their own ledger entries that
//  * offset future balance calculations, rather than retroactively mutating
//  * old expense splits — worth doing as a follow-up if multi-hop netting is
//  * common in your trips.
//  */
// export const confirmPayment = async (
//   tripId: string,
//   transactionId: string,
//   confirmingUid: string
// ): Promise<ISettlement> => {
//   const settlement = await Settlement.findOne({
//     tripId: new Types.ObjectId(tripId),
//   });

//   if (!settlement) throw new AppError('Settlement not found', 404);

//   const txn = settlement.transactions.find(
//     (t) => (t as any)._id.toString() === transactionId
//   );

//   if (!txn) throw new AppError('Transaction not found', 404);
//   if (txn.to !== confirmingUid) {
//     throw new AppError('Only the recipient can confirm receipt', 403);
//   }
//   if (txn.status === 'confirmed') {
//     throw new AppError('Payment already confirmed', 400);
//   }
//   if (txn.status === 'pending') {
//     throw new AppError('Payment was never initiated', 400);
//   }

//   // Confirm the transaction
//   txn.status = 'confirmed';
//   txn.confirmedAt = new Date();

//   // Mark all splits between these two users as paid
//   // This handles the case where one settlement covers multiple expenses
//   await Expense.updateMany(
//     {
//       tripId: new Types.ObjectId(tripId),
//       isSettled: false,
//       'splits.userId': txn.from,
//       paidBy: txn.to,
//     },
//     {
//       $set: {
//         'splits.$[elem].isPaid': true,
//         'splits.$[elem].paidAt': new Date(),
//       },
//     },
//     {
//       arrayFilters: [{ 'elem.userId': txn.from, 'elem.isPaid': false }],
//     }
//   );

//   // Also handle the reverse: where the payer is the 'from' user
//   await Expense.updateMany(
//     {
//       tripId: new Types.ObjectId(tripId),
//       isSettled: false,
//       paidBy: txn.from,
//       'splits.userId': txn.to,
//     },
//     {
//       $set: {
//         'splits.$[elem].isPaid': true,
//         'splits.$[elem].paidAt': new Date(),
//       },
//     },
//     {
//       arrayFilters: [{ 'elem.userId': txn.to, 'elem.isPaid': false }],
//     }
//   );

//   // Update isSettled on fully-settled expenses
//   const affectedExpenses = await Expense.find({
//     tripId: new Types.ObjectId(tripId),
//     isSettled: false,
//   });

//   for (const expense of affectedExpenses) {
//     if (expense.splits.every((s) => s.isPaid)) {
//       expense.isSettled = true;
//       await expense.save();
//     }
//   }

//   await settlement.save();

//   socketServer.notifySettlementCompleted(txn.from, txn.to, txn.amountBase, txn.baseCurrency, tripId);
//   return settlement;
// };

// /**
//  * Dispute a payment.
//  * Either participant can dispute.
//  */
// export const disputePayment = async (
//   tripId: string,
//   transactionId: string,
//   requestingUid: string
// ): Promise<ISettlement> => {
//   const settlement = await Settlement.findOne({
//     tripId: new Types.ObjectId(tripId),
//   });

//   if (!settlement) throw new AppError('Settlement not found', 404);

//   const txn = settlement.transactions.find(
//     (t) => (t as any)._id.toString() === transactionId
//   );

//   if (!txn) throw new AppError('Transaction not found', 404);

//   const isParticipant = txn.from === requestingUid || txn.to === requestingUid;
//   if (!isParticipant) {
//     throw new AppError('You are not part of this transaction', 403);
//   }

//   if (txn.status === 'disputed') {
//     throw new AppError('Transaction is already disputed', 400);
//   }

//   txn.status = 'disputed';
//   await settlement.save();
//   return settlement;
// };

// // ============================================================
// // EXPORT ALL AS NAMESPACE
// // ============================================================

// export const settlementService = {
//   calculateSettlement,
//   getSettlement,
//   markSettlementStale,
//   initiatePayment,
//   confirmPayment,
//   disputePayment,
//   computeMinimumTransactions,
// };

// // import { Types } from 'mongoose';
// // import { Settlement, ISettlement, ISettlementTransaction } from './settlement.model';
// // import { Expense } from '../expense/expense.model';
// // import { Trip } from '../trips/trip.model';
// // import { User } from '../auth/auth.model';
// // import { AppError } from '../../shared/errors/AppError';
// // import { socketServer } from '../../infrastructure/websocket/socket.server';

// // // ============================================================
// // // TYPES
// // // ============================================================

// // interface NetBalance {
// //   userId: string;
// //   displayName: string;
// //   amount: number; // Positive = creditor (owed money), Negative = debtor (owes money)
// // }

// // interface MinTransaction {
// //   from: string;
// //   fromName: string;
// //   to: string;
// //   toName: string;
// //   amount: number;
// // }

// // // ============================================================
// // // MINIMUM TRANSACTION ALGORITHM
// // // ============================================================

// // /**
// //  * Greedy minimum-transaction settlement algorithm.
// //  *
// //  * For N people: max N-1 transfers (instead of O(N²) naive).
// //  * Example: 8 friends, 47 expenses → max 7 transfers.
// //  *
// //  * Algorithm:
// //  * 1. Compute net balance per person
// //  * 2. Split into creditors (+) and debtors (-)
// //  * 3. Greedily match largest creditor with largest debtor
// //  */
// // export const computeMinimumTransactions = (
// //   balances: NetBalance[]
// // ): MinTransaction[] => {
// //   const EPSILON = 0.01; // Ignore balances below 1 paisa

// //   // Creditors: people who are OWED money (positive balance)
// //   const creditors = balances
// //     .filter((b) => b.amount > EPSILON)
// //     .sort((a, b) => b.amount - a.amount);

// //   // Debtors: people who OWE money (negative balance → flip to positive)
// //   const debtors = balances
// //     .filter((b) => b.amount < -EPSILON)
// //     .map((b) => ({ ...b, amount: -b.amount }))
// //     .sort((a, b) => b.amount - a.amount);

// //   const transactions: MinTransaction[] = [];
// //   let i = 0; // Creditor index
// //   let j = 0; // Debtor index

// //   while (i < creditors.length && j < debtors.length) {
// //     const settleAmount = Math.min(creditors[i].amount, debtors[j].amount);
// //     const rounded = parseFloat(settleAmount.toFixed(2));

// //     if (rounded > 0) {
// //       transactions.push({
// //         from: debtors[j].userId,
// //         fromName: debtors[j].displayName,
// //         to: creditors[i].userId,
// //         toName: creditors[i].displayName,
// //         amount: rounded,
// //       });
// //     }

// //     creditors[i].amount -= settleAmount;
// //     debtors[j].amount -= settleAmount;

// //     if (creditors[i].amount < EPSILON) i++;
// //     if (debtors[j].amount < EPSILON) j++;
// //   }

// //   return transactions;
// // };

// // // ============================================================
// // // CALCULATE SETTLEMENT
// // // ============================================================

// // /**
// //  * Calculate the current settlement plan for a trip.
// //  *
// //  * Flow:
// //  * 1. Load all unsettled expenses for the trip
// //  * 2. Compute net balance per member (in baseCurrency)
// //  * 3. Run min-transaction algorithm
// //  * 4. Upsert Settlement document
// //  */
// // export const calculateSettlement = async (
// //   tripId: string,
// //   requestingUid: string
// // ): Promise<ISettlement> => {
// //   // Load trip
// //   const trip = await Trip.findById(tripId);
// //   if (!trip) throw new AppError('Trip not found', 404);
// //   if (!trip.isMember(requestingUid)) {
// //     throw new AppError('You are not a member of this trip', 403);
// //   }

// //   // Load all unsettled expenses
// //   const expenses = await Expense.find({
// //     tripId: new Types.ObjectId(tripId),
// //     isSettled: false,
// //   }).lean();

// //   // Build member display name lookup
// //   const memberMap = new Map<string, string>();
// //   trip.getActiveMembers().forEach((m) => {
// //     memberMap.set(m.userId, m.displayName);
// //   });

// //   // Compute net balance per member
// //   const balanceMap = new Map<string, number>();

// //   // Initialize all active members at 0
// //   trip.getActiveMembers().forEach((m) => balanceMap.set(m.userId, 0));

// //   for (const expense of expenses) {
// //     let unpaidAmount = 0;

// //     // Each unpaid split debits the member
// //     for (const split of expense.splits) {
// //       if (!split.isPaid) {
// //         const current = balanceMap.get(split.userId) ?? 0;
// //         balanceMap.set(split.userId, current - split.amountBase);
// //         unpaidAmount += split.amountBase;
// //       }
// //     }

// //     // Payer gets credit ONLY for the total unpaid splits
// //     const currentPayer = balanceMap.get(expense.paidBy) ?? 0;
// //     balanceMap.set(expense.paidBy, currentPayer + unpaidAmount);
// //   }

// //   // Convert to NetBalance array
// //   const netBalances: NetBalance[] = Array.from(balanceMap.entries()).map(
// //     ([userId, amount]) => ({
// //       userId,
// //       displayName: memberMap.get(userId) ?? 'Unknown',
// //       amount,
// //     })
// //   );

// //   // Run minimum transaction algorithm
// //   const minTransactions = computeMinimumTransactions(netBalances);

// //   // Fetch recipients to get upiId for direct payup link
// //   const receiverIds = minTransactions.map((t) => t.to);
// //   const receivers = await User.find({ _id: { $in: receiverIds } })
// //     .select('_id bankingDetails.upiId')
// //     .lean();
// //   const upiMap = new Map(
// //     receivers.map((r) => [r._id.toString(), r.bankingDetails?.upiId])
// //   );

// //   // Build settlement transaction documents
// //   const settlementTransactions = minTransactions.map((t) => {
// //     let upiDeepLink;
// //     const pa = upiMap.get(t.to);
// //     if (pa) {
// //       const pn = encodeURIComponent(t.toName);
// //       const am = t.amount.toFixed(2);
// //       const cu = trip.baseCurrency;
// //       const tn = encodeURIComponent('TripSplit Settlement');
// //       upiDeepLink = `upi://pay?pa=${encodeURIComponent(pa)}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;
// //     }

// //     return {
// //       from: t.from,
// //       fromName: t.fromName,
// //       to: t.to,
// //       toName: t.toName,
// //       amountBase: t.amount,
// //       baseCurrency: trip.baseCurrency,
// //       status: 'pending' as const,
// //       upiDeepLink,
// //     };
// //   });

// //   // Upsert settlement (one per trip)
// //   const settlement = await Settlement.findOneAndUpdate(
// //     { tripId: new Types.ObjectId(tripId) },
// //     {
// //       tripId: new Types.ObjectId(tripId),
// //       baseCurrency: trip.baseCurrency,
// //       transactions: settlementTransactions,
// //       totalTransactions: settlementTransactions.length,
// //       calculatedAt: new Date(),
// //       isStale: false,
// //     },
// //     { upsert: true, new: true }
// //   );

// //   return settlement;
// // };

// // // ============================================================
// // // GET SETTLEMENT
// // // ============================================================

// // /**
// //  * Get current settlement for a trip.
// //  * Auto-recalculates if missing or stale.
// //  */
// // export const getSettlement = async (
// //   tripId: string,
// //   requestingUid: string
// // ): Promise<ISettlement> => {
// //   const existing = await Settlement.findOne({
// //     tripId: new Types.ObjectId(tripId),
// //   });

// //   if (!existing || existing.isStale) {
// //     return calculateSettlement(tripId, requestingUid);
// //   }

// //   return existing;
// // };

// // // ============================================================
// // // MARK STALE
// // // ============================================================

// // /**
// //  * Mark settlement as stale when expenses change.
// //  * Called by Expense service after create/update/delete.
// //  */
// // export const markSettlementStale = async (tripId: string): Promise<void> => {
// //   await Settlement.findOneAndUpdate(
// //     { tripId: new Types.ObjectId(tripId) },
// //     { $set: { isStale: true } }
// //   );
// // };

// // // ============================================================
// // // UPI PAYMENT FLOW
// // // ============================================================

// // /**
// //  * Initiate a UPI payment for a settlement transaction.
// //  * Generates UPI deep link and marks transaction as 'initiated'.
// //  *
// //  * UPI deep link format:
// //  * upi://pay?pa=vpa@bank&pn=Name&am=Amount&cu=INR&tn=Note
// //  */
// // export const initiatePayment = async (
// //   tripId: string,
// //   transactionId: string,
// //   fromUid: string
// // ): Promise<{ transaction: ISettlementTransaction; upiDeepLink: string }> => {
// //   const settlement = await Settlement.findOne({
// //     tripId: new Types.ObjectId(tripId),
// //   });

// //   if (!settlement) {
// //     throw new AppError('No settlement found. Calculate settlement first.', 404);
// //   }

// //   const txn = settlement.transactions.find(
// //     (t) => (t as any)._id.toString() === transactionId
// //   );

// //   if (!txn) throw new AppError('Transaction not found', 404);
// //   if (txn.from !== fromUid) {
// //     throw new AppError('This is not your payment to make', 403);
// //   }
// //   if (txn.status === 'confirmed') {
// //     throw new AppError('Payment already confirmed', 400);
// //   }

// //   // Get recipient's UPI ID
// //   const recipient = await User.findOne({
// //     _id: txn.to,
// //     isActive: true,
// //     isDeleted: false,
// //   }).select('bankingDetails.upiId displayName').lean();

// //   if (!recipient?.bankingDetails?.upiId) {
// //     throw new AppError(
// //       `${txn.toName} has not set up their UPI ID yet`,
// //       400
// //     );
// //   }

// //   // Build UPI deep link
// //   const pa = encodeURIComponent(recipient.bankingDetails.upiId);
// //   const pn = encodeURIComponent(txn.toName);
// //   const am = txn.amountBase.toFixed(2);
// //   const cu = txn.baseCurrency;
// //   const tn = encodeURIComponent('TripSplit Settlement');
// //   const upiDeepLink = `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;

// //   // Update transaction
// //   txn.status = 'initiated';
// //   txn.upiDeepLink = upiDeepLink;
// //   txn.initiatedAt = new Date();

// //   await settlement.save();

// //   socketServer.notifySettlementRequest(txn.to, txn.fromName, txn.amountBase, txn.baseCurrency, tripId);

// //   return {
// //     transaction: txn,
// //     upiDeepLink,
// //   };
// // };

// // /**
// //  * Confirm receipt of a payment.
// //  * Only the recipient can confirm.
// //  * Marks all relevant expense splits as paid.
// //  */
// // export const confirmPayment = async (
// //   tripId: string,
// //   transactionId: string,
// //   confirmingUid: string
// // ): Promise<ISettlement> => {
// //   const settlement = await Settlement.findOne({
// //     tripId: new Types.ObjectId(tripId),
// //   });

// //   if (!settlement) throw new AppError('Settlement not found', 404);

// //   const txn = settlement.transactions.find(
// //     (t) => (t as any)._id.toString() === transactionId
// //   );

// //   if (!txn) throw new AppError('Transaction not found', 404);
// //   if (txn.to !== confirmingUid) {
// //     throw new AppError('Only the recipient can confirm receipt', 403);
// //   }
// //   if (txn.status === 'confirmed') {
// //     throw new AppError('Payment already confirmed', 400);
// //   }
// //   if (txn.status === 'pending') {
// //     throw new AppError('Payment was never initiated', 400);
// //   }

// //   // Confirm the transaction
// //   txn.status = 'confirmed';
// //   txn.confirmedAt = new Date();

// //   // Mark all splits between these two users as paid
// //   // This handles the case where one settlement covers multiple expenses
// //   await Expense.updateMany(
// //     {
// //       tripId: new Types.ObjectId(tripId),
// //       isSettled: false,
// //       'splits.userId': txn.from,
// //       paidBy: txn.to,
// //     },
// //     {
// //       $set: {
// //         'splits.$[elem].isPaid': true,
// //         'splits.$[elem].paidAt': new Date(),
// //       },
// //     },
// //     {
// //       arrayFilters: [{ 'elem.userId': txn.from, 'elem.isPaid': false }],
// //     }
// //   );

// //   // Also handle the reverse: where the payer is the 'from' user
// //   await Expense.updateMany(
// //     {
// //       tripId: new Types.ObjectId(tripId),
// //       isSettled: false,
// //       paidBy: txn.from,
// //       'splits.userId': txn.to,
// //     },
// //     {
// //       $set: {
// //         'splits.$[elem].isPaid': true,
// //         'splits.$[elem].paidAt': new Date(),
// //       },
// //     },
// //     {
// //       arrayFilters: [{ 'elem.userId': txn.to, 'elem.isPaid': false }],
// //     }
// //   );

// //   // Update isSettled on fully-settled expenses
// //   const affectedExpenses = await Expense.find({
// //     tripId: new Types.ObjectId(tripId),
// //     isSettled: false,
// //   });

// //   for (const expense of affectedExpenses) {
// //     if (expense.splits.every((s) => s.isPaid)) {
// //       expense.isSettled = true;
// //       await expense.save();
// //     }
// //   }

// //   await settlement.save();

// //   socketServer.notifySettlementCompleted(txn.from, txn.to, txn.amountBase, txn.baseCurrency, tripId);
// //   return settlement;
// // };

// // /**
// //  * Dispute a payment.
// //  * Either participant can dispute.
// //  */
// // export const disputePayment = async (
// //   tripId: string,
// //   transactionId: string,
// //   requestingUid: string
// // ): Promise<ISettlement> => {
// //   const settlement = await Settlement.findOne({
// //     tripId: new Types.ObjectId(tripId),
// //   });

// //   if (!settlement) throw new AppError('Settlement not found', 404);

// //   const txn = settlement.transactions.find(
// //     (t) => (t as any)._id.toString() === transactionId
// //   );

// //   if (!txn) throw new AppError('Transaction not found', 404);

// //   const isParticipant = txn.from === requestingUid || txn.to === requestingUid;
// //   if (!isParticipant) {
// //     throw new AppError('You are not part of this transaction', 403);
// //   }

// //   if (txn.status === 'disputed') {
// //     throw new AppError('Transaction is already disputed', 400);
// //   }

// //   txn.status = 'disputed';
// //   await settlement.save();
// //   return settlement;
// // };

// // // ============================================================
// // // EXPORT ALL AS NAMESPACE
// // // ============================================================

// // export const settlementService = {
// //   calculateSettlement,
// //   getSettlement,
// //   markSettlementStale,
// //   initiatePayment,
// //   confirmPayment,
// //   disputePayment,
// //   computeMinimumTransactions,
// // };

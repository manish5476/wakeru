import mongoose, { Types, ClientSession } from 'mongoose';
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
import { Reminder } from '../reminders/reminder.model';
import { NotificationService } from '../notification/notification.service';

// ============================================================
// CONSTANTS
// ============================================================

/** Minimum minutes between payment reminders for the same transaction. */
const REMINDER_COOLDOWN_MINUTES = 30;

const notificationService = new NotificationService();

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

const confirmPaymentWithoutSession = async (
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
    // Idempotent: return settlement if already confirmed
    return settlement;
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

  // Also emit persistent notification (offline users will see it later)
  notificationService.notifySettlementCompleted(
    txn.from,
    txn.to,
    txn.amountBase,
    txn.baseCurrency,
    tripId
  ).catch((err: Error) => logger.error('Failed to persist settlement-completed notification:', err));

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
    notificationService.notifyTripFullySettled(tripId).catch((err: Error) =>
      logger.error('Failed to persist trip-fully-settled notification:', err)
    );
  }

  achievementService.onSettlementConfirmed(tripId, txn.from, txn.to).catch(err => {
    logger.error('Failed to process achievements on settlement confirmed:', err);
  });

  return settlement;
};

export const confirmPayment = async (
  tripId: string,
  transactionId: string,
  confirmingUid: string,
  notes?: string
): Promise<ISettlement> => {
  let session: ClientSession | null = null;
  try {
    session = await mongoose.startSession();
  } catch {
    return confirmPaymentWithoutSession(tripId, transactionId, confirmingUid, notes);
  }

  try {
    let resultSettlement: ISettlement | null = null;
    let txnToNotify: { from: string; to: string; amountBase: number; baseCurrency: string } | null = null;
    let fullySettled = false;

    await session.withTransaction(async () => {
      const settlement = await Settlement.findOne({
        tripId: new Types.ObjectId(tripId),
      }).session(session);

      if (!settlement) throw new AppError('Settlement not found', 404);

      const txn = settlement.transactions.find(
        (t) => (t as any)._id.toString() === transactionId
      );

      if (!txn) throw new AppError('Transaction not found', 404);
      if (txn.to !== confirmingUid) {
        throw new AppError('Only the recipient can confirm receipt', 403);
      }
      if (txn.status === 'confirmed') {
        // Idempotent: return settlement if already confirmed
        resultSettlement = settlement;
        return;
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
          session,
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
          session,
        }
      );

      // Bulk update isSettled on fully-settled expenses
      const affectedExpenses = await Expense.find({
        tripId: new Types.ObjectId(tripId),
        isSettled: false,
      }).session(session);

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
          })),
          { session }
        );
      }

      await settlement.save({ session });
      resultSettlement = settlement;
      txnToNotify = {
        from: txn.from,
        to: txn.to,
        amountBase: txn.amountBase,
        baseCurrency: txn.baseCurrency,
      };
      fullySettled = settlement.isFullySettled;
    });

    if (txnToNotify) {
      const { from, to, amountBase, baseCurrency } = txnToNotify as { from: string; to: string; amountBase: number; baseCurrency: string };
      notificationService.notifySettlementCompleted(
        from,
        to,
        amountBase,
        baseCurrency,
        tripId
      ).catch((err: Error) => logger.error('Failed to persist settlement-completed notification:', err));

      socketServer.notifySettlementCompleted(
        from,
        to,
        amountBase,
        baseCurrency,
        tripId
      );

      if (fullySettled) {
        socketServer.notifyTripFullySettled(tripId);
        notificationService.notifyTripFullySettled(tripId).catch((err: Error) =>
          logger.error('Failed to persist trip-fully-settled notification:', err)
        );
      }

      achievementService.onSettlementConfirmed(tripId, from, to).catch(err => {
        logger.error('Failed to process achievements on settlement confirmed:', err);
      });
    }

    return resultSettlement!;
  } catch (error: any) {
    if (error.message?.includes('Transactions are not supported') || error.message?.includes('replica set')) {
      return confirmPaymentWithoutSession(tripId, transactionId, confirmingUid, notes);
    }
    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// ============================================================
// SETTLE ALL — Payer initiates all outstanding transactions
// ============================================================

export const settleAll = async (
  tripId: string,
  payerUid: string
): Promise<ISettlement> => {
  const settlement = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  });

  if (!settlement) throw new AppError('Settlement not found', 404);

  // Find transactions where the user is the PAYER and not yet confirmed
  const transactionsToInitiate = settlement.transactions.filter(
    (txn) =>
      txn.from === payerUid &&
      (txn.status === 'pending' || txn.status === 'rejected')
  );

  if (transactionsToInitiate.length === 0) {
    throw new AppError('No pending payments found to initiate.', 400);
  }

  const now = new Date();

  for (const txn of transactionsToInitiate) {
    txn.status = 'initiated';
    txn.initiatedAt = now;

    settlement.history.push({
      action: 'settle_all_initiated',
      actorUid: payerUid,
      transactionId: (txn as any)._id,
      amount: txn.amountBase,
      timestamp: now,
      metadata: { toName: txn.toName },
    });
  }

  await settlement.save();

  // Notify each receiver (real-time + persistent)
  for (const txn of transactionsToInitiate) {
    socketServer.notifyPaymentInitiated(
      txn.to,
      txn.fromName,
      txn.amountBase,
      txn.baseCurrency,
      tripId,
      (txn as any)._id.toString()
    );
    notificationService.notifyPaymentInitiated(
      txn.from,
      txn.to,
      txn.amountBase,
      txn.baseCurrency,
      tripId,
      (txn as any)._id.toString()
    ).catch((err: Error) => logger.error('Failed to persist payment-initiated notification:', err));
  }

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
// SETTLE SELECTED — Payer initiates a chosen subset of transactions
// ============================================================

export const settleSelected = async (
  tripId: string,
  payerUid: string,
  transactionIds: string[]
): Promise<ISettlement> => {
  if (!transactionIds || transactionIds.length === 0) {
    throw new AppError('No transactions selected', 400);
  }

  const settlement = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  });

  if (!settlement) throw new AppError('Settlement not found', 404);

  const now = new Date();
  const initiated: ISettlementTransaction[] = [];

  for (const txnId of transactionIds) {
    const txn = settlement.transactions.find(
      (t) => (t as any)._id.toString() === txnId
    );

    if (!txn) throw new AppError(`Transaction ${txnId} not found`, 404);
    if (txn.from !== payerUid) {
      throw new AppError(
        `Transaction ${txnId} does not belong to you`,
        403
      );
    }
    if (txn.status === 'confirmed') {
      // Skip already confirmed — idempotent
      continue;
    }
    if (txn.status === 'initiated') {
      // Already initiated — idempotent, skip
      continue;
    }

    txn.status = 'initiated';
    txn.initiatedAt = now;
    initiated.push(txn);

    settlement.history.push({
      action: 'payment_initiated',
      actorUid: payerUid,
      transactionId: (txn as any)._id,
      amount: txn.amountBase,
      timestamp: now,
      metadata: { source: 'settle_selected' },
    });
  }

  await settlement.save();

  // Notify receivers
  for (const txn of initiated) {
    socketServer.notifyPaymentInitiated(
      txn.to,
      txn.fromName,
      txn.amountBase,
      txn.baseCurrency,
      tripId,
      (txn as any)._id.toString()
    );
    notificationService.notifyPaymentInitiated(
      txn.from,
      txn.to,
      txn.amountBase,
      txn.baseCurrency,
      tripId,
      (txn as any)._id.toString()
    ).catch((err: Error) => logger.error('Failed to persist payment-initiated notification:', err));
  }

  return settlement;
};

// ============================================================
// SETTLE SINGLE — Payer initiates one transaction (Mark Paid)
// ============================================================

export const settleSingle = async (
  tripId: string,
  payerUid: string,
  transactionId: string
): Promise<{ settlement: ISettlement; transaction: ISettlementTransaction }> => {
  const settlement = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  });

  if (!settlement) throw new AppError('Settlement not found', 404);

  const txn = settlement.transactions.find(
    (t) => (t as any)._id.toString() === transactionId
  );

  if (!txn) throw new AppError('Transaction not found', 404);
  if (txn.from !== payerUid) {
    throw new AppError('This is not your payment to make', 403);
  }

  // Idempotency: already initiated or confirmed
  if (txn.status === 'initiated') {
    return { settlement, transaction: txn };
  }
  if (txn.status === 'confirmed') {
    return { settlement, transaction: txn };
  }

  const now = new Date();
  txn.status = 'initiated';
  txn.initiatedAt = now;

  settlement.history.push({
    action: 'payment_initiated',
    actorUid: payerUid,
    transactionId: (txn as any)._id,
    amount: txn.amountBase,
    timestamp: now,
    metadata: { source: 'settle_single' },
  });

  await settlement.save();

  socketServer.notifyPaymentInitiated(
    txn.to,
    txn.fromName,
    txn.amountBase,
    txn.baseCurrency,
    tripId,
    (txn as any)._id.toString()
  );
  notificationService.notifyPaymentInitiated(
    txn.from,
    txn.to,
    txn.amountBase,
    txn.baseCurrency,
    tripId,
    (txn as any)._id.toString()
  ).catch((err: Error) => logger.error('Failed to persist payment-initiated notification:', err));

  return { settlement, transaction: txn };
};

// ============================================================
// REMIND PAYER
// ============================================================

export const remindPayer = async (
  tripId: string,
  reminderSenderUid: string,
  transactionId: string
): Promise<void> => {
  const settlement = await Settlement.findOne({
    tripId: new Types.ObjectId(tripId),
  });

  if (!settlement) throw new AppError('Settlement not found', 404);

  const txn = settlement.transactions.find(
    (t) => (t as any)._id.toString() === transactionId
  );

  if (!txn) throw new AppError('Transaction not found', 404);

  // Only the receiver can remind the payer
  if (txn.to !== reminderSenderUid) {
    throw new AppError('Only the recipient can send a reminder', 403);
  }

  // Cannot remind if already confirmed or cancelled
  if (txn.status === 'confirmed') {
    throw new AppError('This payment is already confirmed', 400);
  }

  // Cooldown: check for recent reminder
  const cooldownCutoff = new Date(
    Date.now() - REMINDER_COOLDOWN_MINUTES * 60 * 1000
  );
  const recentReminder = await Reminder.findOne({
    userId: reminderSenderUid,
    targetUserId: txn.from,
    settlementId: settlement._id,
    'metadata.transactionId': transactionId,
    type: 'settlement',
    createdAt: { $gte: cooldownCutoff },
  });

  if (recentReminder) {
    throw new AppError(
      `You already sent a reminder recently. Please wait ${REMINDER_COOLDOWN_MINUTES} minutes before sending another.`,
      429
    );
  }

  // Create reminder document
  await Reminder.create({
    userId: reminderSenderUid,
    targetUserId: txn.from,
    targetUserName: txn.fromName,
    tripId: settlement.tripId,
    tripName: undefined,
    settlementId: settlement._id,
    type: 'settlement',
    title: `Payment Reminder`,
    message: `${txn.toName} is waiting for your payment of ${txn.baseCurrency} ${txn.amountBase}`,
    frequency: 'once',
    nextTriggerAt: new Date(),
    channels: { inApp: true, push: true, email: false, sms: false },
    metadata: { transactionId, tripId, amount: txn.amountBase },
  });

  // Real-time socket notification to the payer
  socketServer.notifyPaymentReminder(
    txn.from,
    txn.toName,
    txn.amountBase,
    txn.baseCurrency,
    tripId,
    transactionId
  );

  // Persistent in-app notification to the payer
  notificationService.notifyPaymentReminder(
    txn.from,
    txn.to,
    txn.toName,
    txn.amountBase,
    txn.baseCurrency,
    tripId,
    transactionId
  ).catch((err: Error) => logger.error('Failed to persist payment-reminder notification:', err));
};

// ============================================================
// REJECT PAYMENT
// ============================================================

export const rejectPayment = async (
  tripId: string,
  transactionId: string,
  receiverUid: string,
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

  if (txn.to !== receiverUid) {
    throw new AppError('Only the recipient can reject a payment', 403);
  }

  if (txn.status !== 'initiated') {
    throw new AppError(
      'Only initiated payments can be rejected. The payer must first mark it as paid.',
      400
    );
  }

  const now = new Date();

  // Store rejection info but reset status to pending so payer can retry
  txn.rejectedAt = now;
  txn.rejectionReason = reason;
  txn.status = 'pending';

  settlement.history.push({
    action: 'payment_rejected',
    actorUid: receiverUid,
    transactionId: (txn as any)._id,
    amount: txn.amountBase,
    timestamp: now,
    metadata: { reason, rejectedBy: txn.toName },
  });

  await settlement.save();

  // Notify the payer
  socketServer.notifyPaymentRejected(
    txn.from,
    txn.toName,
    txn.amountBase,
    txn.baseCurrency,
    tripId,
    transactionId
  );
  notificationService.notifyPaymentRejected(
    txn.from,
    txn.to,
    txn.toName,
    txn.amountBase,
    txn.baseCurrency,
    tripId
  ).catch((err: Error) => logger.error('Failed to persist payment-rejected notification:', err));

  return settlement;
};

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
  settleAll,
  settleSelected,
  settleSingle,
  remindPayer,
  rejectPayment,
  disputePayment,
  retryPayment,
  getMySettlements,
  exportSettlement,
  computeMinimumTransactions,
  getSettlementHistory,
};


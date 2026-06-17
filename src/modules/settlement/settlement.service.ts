
// import { Types } from 'mongoose';
// import { Settlement, ISettlement, ISettlementTransaction } from './settlement.model';
// import { Expense } from '../expense/expense.model';
// import { Trip } from '../trips/trip.model';
// import { AppError } from '../../shared/errors/AppError';

// // ─────────────────────────────────────────────────────────────────────────────
// // TYPES
// // ─────────────────────────────────────────────────────────────────────────────

// interface NetBalance {
//   userId: string;
//   displayName: string;
//   amount: number; // positive = owed money (creditor), negative = owes money (debtor)
// }

// interface MinTransaction {
//   from: string;
//   fromName: string;
//   to: string;
//   toName: string;
//   amount: number;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // CORE ALGORITHM — Minimum Transaction Debt Settlement
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * For N people, naive settlement needs O(N²) transfers.
//  * This greedy algorithm reduces it to at most N-1 transfers.
//  *
//  * Example: 8 friends, 47 expenses → 7 transfers max instead of up to 28.
//  *
//  * Steps:
//  * 1. Compute net balance per person (total paid - total owed)
//  * 2. Split into creditors (positive) and debtors (negative)
//  * 3. Greedily match largest creditor with largest debtor
//  */
// export const computeMinimumTransactions = (
//   balances: NetBalance[]
// ): MinTransaction[] => {
//   const EPSILON = 0.01; // ignore balances below 1 paisa

//   const creditors = balances
//     .filter((b) => b.amount > EPSILON)
//     .map((b) => ({ ...b }))
//     .sort((a, b) => b.amount - a.amount);

//   const debtors = balances
//     .filter((b) => b.amount < -EPSILON)
//     .map((b) => ({ ...b, amount: -b.amount })) // flip to positive for easier math
//     .sort((a, b) => b.amount - a.amount);

//   const transactions: MinTransaction[] = [];
//   let i = 0;
//   let j = 0;

//   while (i < creditors.length && j < debtors.length) {
//     const settleAmount = Math.min(creditors[i].amount, debtors[j].amount);

//     transactions.push({
//       from: debtors[j].userId,
//       fromName: debtors[j].displayName,
//       to: creditors[i].userId,
//       toName: creditors[i].displayName,
//       amount: parseFloat(settleAmount.toFixed(2)),
//     });

//     creditors[i].amount -= settleAmount;
//     debtors[j].amount -= settleAmount;

//     if (creditors[i].amount < EPSILON) i++;
//     if (debtors[j].amount < EPSILON) j++;
//   }

//   return transactions;
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // CALCULATE & STORE SETTLEMENT
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * Calculate the current settlement plan for a trip.
//  *
//  * Flow:
//  * 1. Load all unsettled expenses for the trip
//  * 2. Compute net balance per member
//  * 3. Run minimum-transaction algorithm
//  * 4. Store result as a Settlement document (replaces previous)
//  *
//  * This is called:
//  * - When a user opens the settlement screen
//  * - After any expense is added, updated, or deleted (marks existing as stale)
//  */
// export const calculateSettlement = async (
//   tripId: string,
//   requestingUid: string
// ): Promise<ISettlement> => {
//   const trip = await Trip.findById(tripId);
//   if (!trip) throw new AppError('Trip not found', 404);
//   if (!trip.isMember(requestingUid)) throw new AppError('Access denied', 403);

//   // Load ALL expenses for this trip (settled ones still affect historical balances
//   // but we only compute based on unpaid splits)
//   const expenses = await Expense.find({
//     tripId: new Types.ObjectId(tripId),
//     isSettled: false,
//   }).lean();

//   // Build member lookup for display names
//   const memberMap = new Map(
//     trip.getActiveMembers().map((m) => [m.userId, m.displayName])
//   );

//   // Compute net balance per member across all unsettled expenses
//   const balanceMap = new Map<string, number>();

//   // Initialize all active members at 0
//   trip.getActiveMembers().forEach((m) => balanceMap.set(m.userId, 0));

//   for (const expense of expenses) {
//     // Payer gets credit for the full amount
//     const payerBalance = balanceMap.get(expense.paidBy) ?? 0;
//     balanceMap.set(expense.paidBy, payerBalance + expense.amountBase);

//     // Each member in splits owes their share
//     for (const split of expense.splits) {
//       if (!split.isPaid) {
//         const memberBalance = balanceMap.get(split.userId) ?? 0;
//         balanceMap.set(split.userId, memberBalance - split.amountBase);
//       }
//     }
//   }

//   const netBalances: NetBalance[] = Array.from(balanceMap.entries()).map(
//     ([userId, amount]) => ({
//       userId,
//       displayName: memberMap.get(userId) ?? 'Unknown',
//       amount,
//     })
//   );

//   const minTransactions = computeMinimumTransactions(netBalances);

//   // Build settlement transaction documents
//   const settlementTransactions: ISettlementTransaction[] = minTransactions.map(
//     (t) => ({
//       from: t.from,
//       fromName: t.fromName,
//       to: t.to,
//       toName: t.toName,
//       amountBase: t.amount,
//       baseCurrency: trip.baseCurrency,
//       status: 'pending' as const,
//     })
//   );

//   // Replace any existing settlement for this trip
//   const settlement = await Settlement.findOneAndUpdate(
//     { tripId: new Types.ObjectId(tripId) },
//     {
//       tripId: new Types.ObjectId(tripId),
//       transactions: settlementTransactions,
//       totalTransactions: settlementTransactions.length,
//       calculatedAt: new Date(),
//       isStale: false,
//     },
//     { upsert: true, new: true }
//   );

//   return settlement;
// };

// /**
//  * Get the current settlement for a trip.
//  * If none exists or it's stale, recalculates automatically.
//  */
// export const getSettlement = async (
//   tripId: string,
//   requestingUid: string
// ): Promise<ISettlement> => {
//   const existing = await Settlement.findOne({
//     tripId: new Types.ObjectId(tripId),
//   });

//   // Recalculate if missing or stale
//   if (!existing || existing.isStale) {
//     return calculateSettlement(tripId, requestingUid);
//   }

//   return existing;
// };

// /**
//  * Mark the settlement for a trip as stale.
//  * Called automatically whenever an expense is added, edited, or deleted.
//  */
// export const markSettlementStale = async (tripId: string): Promise<void> => {
//   await Settlement.findOneAndUpdate(
//     { tripId: new Types.ObjectId(tripId) },
//     { isStale: true }
//   );
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // UPI PAYMENT FLOW
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * Initiate a payment for a settlement transaction.
//  * Generates a UPI deep link and marks the transaction as 'initiated'.
//  *
//  * UPI deep link format:
//  * upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=TripSplit+Settlement
//  */
// export const initiatePayment = async (
//   tripId: string,
//   transactionId: string,
//   fromUid: string
// ): Promise<{ transaction: ISettlementTransaction; upiDeepLink: string }> => {
//   const settlement = await Settlement.findOne({
//     tripId: new Types.ObjectId(tripId),
//   });

//   if (!settlement) throw new AppError('No settlement found for this trip', 404);

//   const txn = settlement.transactions.find(
//     (t) => t._id?.toString() === transactionId
//   );

//   if (!txn) throw new AppError('Transaction not found', 404);
//   if (txn.from !== fromUid) throw new AppError('This is not your payment to make', 403);
//   if (txn.status === 'confirmed') throw new AppError('Payment already confirmed', 400);

//   // Load recipient UPI ID from their User document
//   const { User } = await import('../user/user.model');
//   const recipient = await User.findOne({ firebaseUid: txn.to }).lean();

//   let upiDeepLink = '';
//   if (recipient?.upiId) {
//     const note = encodeURIComponent('TripSplit Settlement');
//     const name = encodeURIComponent(txn.toName);
//     upiDeepLink = `upi://pay?pa=${recipient.upiId}&pn=${name}&am=${txn.amountBase}&cu=${txn.baseCurrency}&tn=${note}`;
//   }

//   txn.status = 'initiated';
//   txn.upiDeepLink = upiDeepLink;
//   txn.initiatedAt = new Date();

//   await settlement.save();

//   return { transaction: txn, upiDeepLink };
// };

// /**
//  * Confirm receipt of a payment.
//  * Can only be confirmed by the recipient (the 'to' user).
//  * Marks all relevant expense splits as paid.
//  */
// export const confirmPayment = async (
//   tripId: string,
//   transactionId: string,
//   confirmingUid: string
// ): Promise<ISettlement> => {
//   const settlement = await Settlement.findOne({
//     tripId: new Types.ObjectId(tripId),
//   });

//   if (!settlement) throw new AppError('No settlement found', 404);

//   const txn = settlement.transactions.find(
//     (t) => t._id?.toString() === transactionId
//   );

//   if (!txn) throw new AppError('Transaction not found', 404);
//   if (txn.to !== confirmingUid) throw new AppError('Only the recipient can confirm payment', 403);
//   if (txn.status === 'confirmed') throw new AppError('Already confirmed', 400);
//   if (txn.status === 'pending') throw new AppError('Payment was never initiated', 400);

//   txn.status = 'confirmed';
//   txn.confirmedAt = new Date();

//   // Mark all splits between these two users as paid
//   await Expense.updateMany(
//     {
//       tripId: new Types.ObjectId(tripId),
//       'splits.userId': txn.from,
//       paidBy: txn.to,
//       isSettled: false,
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

//   // Update isSettled flag on any now-fully-settled expenses
//   const expenses = await Expense.find({
//     tripId: new Types.ObjectId(tripId),
//     isSettled: false,
//   });

//   for (const expense of expenses) {
//     if (expense.splits.every((s: any) => s.isPaid)) {
//       expense.isSettled = true;
//       await expense.save();
//     }
//   }

//   await settlement.save();
//   return settlement;
// };

// /**
//  * Dispute a payment (flag it for group review).
//  */
// export const disputePayment = async (
//   tripId: string,
//   transactionId: string,
//   requestingUid: string
// ): Promise<ISettlement> => {
//   const settlement = await Settlement.findOne({
//     tripId: new Types.ObjectId(tripId),
//   });

//   if (!settlement) throw new AppError('No settlement found', 404);

//   const txn = settlement.transactions.find(
//     (t) => t._id?.toString() === transactionId
//   );

//   if (!txn) throw new AppError('Transaction not found', 404);

//   const isParticipant = txn.from === requestingUid || txn.to === requestingUid;
//   if (!isParticipant) throw new AppError('You are not part of this transaction', 403);

//   txn.status = 'disputed';
//   await settlement.save();
//   return settlement;
// };

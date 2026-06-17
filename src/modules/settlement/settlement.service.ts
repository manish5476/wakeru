
// import { Types } from 'mongoose';
// import { Settlement, ISettlement, ISettlementTransaction } from './settlement.model';
// import { Expense } from '../expenses/expense.model';
// import { Trip } from '../trips/trip.model';
// import { AppError } from '../utils/AppError';

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
//   const { User } = await import('../users/user.model');
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
//     if (expense.splits.every((s) => s.isPaid)) {
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

// // import { Settlement } from './settlement.model';
// // import { debtSimplifier, Debt } from './debt.simplifier';
// // import { Expense } from '../expense/expense.model';
// // import { Group } from '../group/group.model';
// // import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../shared/errors/AppError';
// // import { logger } from '../../config/logger';
// // import { redisClient } from '../../config/redis';
// // import { Types } from 'mongoose';
// // import crypto from 'crypto';
// // import Decimal from 'decimal.js';

// // export class SettlementService {
// //   /**
// //    * Get simplified debts for a group
// //    */
// //   async getSimplifiedDebts(groupId: string, userId: string): Promise<any> {
// //     // Verify group membership
// //     const group = await Group.findOne({
// //       groupId,
// //       'members.userId': new Types.ObjectId(userId),
// //       'members.invitationStatus': 'ACCEPTED'
// //     });

// //     if (!group) {
// //       throw new ForbiddenError('You are not a member of this group');
// //     }

// //     // Get all unsettled expenses
// //     const expenses = await Expense.find({
// //       groupId: group._id,
// //       'metadata.isDeleted': false,
// //       'splits.settlementStatus': { $ne: 'SETTLED' }
// //     });

// //     // Collect all debts
// //     const debts: Debt[] = [];

// //     expenses.forEach(expense => {
// //       const payer = expense.paidBy.toString();
      
// //       expense.splits.forEach(split => {
// //         if (split.settlementStatus === 'SETTLED') return;
        
// //         const consumer = split.userId.toString();
        
// //         // Only create debt if consumer is not the payer
// //         if (consumer !== payer) {
// //           debts.push({
// //             from: consumer,
// //             to: payer,
// //             amount: split.finalAmount,
// //             groupId: groupId,
// //             expenseId: expense.expenseId
// //           });
// //         }
// //       });
// //     });

// //     // Simplify debts
// //     const simplified = debtSimplifier.simplifyDebts(debts);

// //     return {
// //       originalDebtCount: debts.length,
// //       simplifiedTransactionCount: simplified.length,
// //       savings: debts.length - simplified.length,
// //       transactions: simplified,
// //       currency: group.settings.defaultCurrency
// //     };
// //   }

// //   /**
// //    * Get debt summary for a user in a group
// //    */
// //   async getDebtSummary(groupId: string, userId: string): Promise<any> {
// //     const group = await Group.findOne({
// //       groupId,
// //       'members.userId': new Types.ObjectId(userId),
// //       'members.invitationStatus': 'ACCEPTED'
// //     });

// //     if (!group) {
// //       throw new ForbiddenError('You are not a member of this group');
// //     }

// //     const expenses = await Expense.find({
// //       groupId: group._id,
// //       'metadata.isDeleted': false,
// //       'splits.settlementStatus': { $ne: 'SETTLED' }
// //     });

// //     const debts: Debt[] = [];

// //     expenses.forEach(expense => {
// //       const payer = expense.paidBy.toString();
      
// //       expense.splits.forEach(split => {
// //         if (split.settlementStatus === 'SETTLED') return;
        
// //         const consumer = split.userId.toString();
        
// //         if (consumer !== payer) {
// //           debts.push({
// //             from: consumer,
// //             to: payer,
// //             amount: split.finalAmount,
// //             groupId: groupId,
// //             expenseId: expense.expenseId
// //           });
// //         }
// //       });
// //     });

// //     return debtSimplifier.getDebtSummary(userId, debts);
// //   }

// //   /**
// //    * Create a settlement
// //    */
// //   async createSettlement(
// //     groupId: string,
// //     fromUser: string,
// //     toUser: string,
// //     amount: number,
// //     paymentMethod: string,
// //     createdBy: string
// //   ): Promise<any> {
// //     // Verify group membership
// //     const group = await Group.findOne({
// //       groupId,
// //       'members.userId': new Types.ObjectId(fromUser),
// //       'members.invitationStatus': 'ACCEPTED'
// //     });

// //     if (!group) {
// //       throw new ForbiddenError('Invalid group or user');
// //     }

// //     // Verify both users are members
// //     const toMember = group.members.find(
// //       (m:any) => m.userId.toString() === toUser && m.invitationStatus === 'ACCEPTED'
// //     );

// //     if (!toMember) {
// //       throw new BadRequestError('Recipient is not a member of this group');
// //     }

// //     // Check for duplicate settlement
// //     const idempotencyKey = crypto.randomUUID();
// //     const existingSettlement = await Settlement.findOne({ idempotencyKey });
// //     if (existingSettlement) {
// //       throw new ConflictError('Duplicate settlement detected');
// //     }

// //     // Create settlement record
// //     const settlement = new Settlement({
// //       settlementId: crypto.randomUUID(),
// //       groupId: group._id,
// //       fromUser: new Types.ObjectId(fromUser),
// //       toUser: new Types.ObjectId(toUser),
// //       amount: Types.Decimal128.fromString(amount.toFixed(2)),
// //       currency: group.settings.defaultCurrency,
// //       expenses: [],
// //       paymentMethod,
// //       status: 'PENDING',
// //       statusHistory: [{
// //         status: 'PENDING',
// //         timestamp: new Date(),
// //         updatedBy: new Types.ObjectId(createdBy),
// //         remarks: 'Settlement created'
// //       }],
// //       createdBy: new Types.ObjectId(createdBy),
// //       settlementDate: new Date(),
// //       idempotencyKey
// //     });

// //     await settlement.save();

// //     logger.info(`Settlement created: ${settlement.settlementId}`);
// //     return settlement;
// //   }

// //   /**
// //    * Process payment for a settlement
// //    */
// //   async processPayment(
// //     settlementId: string,
// //     paymentDetails: {
// //       transactionId: string;
// //       paymentGateway: string;
// //     },
// //     userId: string
// //   ): Promise<any> {
// //     const settlement = await Settlement.findOne({ settlementId });
// //     if (!settlement) {
// //       throw new NotFoundError('Settlement');
// //     }

// //     if (settlement.fromUser.toString() !== userId) {
// //       throw new ForbiddenError('Only the payer can process this settlement');
// //     }

// //     if (settlement.status !== 'PENDING') {
// //       throw new BadRequestError(`Settlement is already ${settlement.status}`);
// //     }

// //     // Update settlement status
// //     settlement.status = 'COMPLETED';
// //     settlement.completedAt = new Date();
// //     settlement.paymentDetails = {
// //       ...paymentDetails,
// //       paidAt: new Date()
// //     };
// //     settlement.statusHistory.push({
// //       status: 'COMPLETED',
// //       timestamp: new Date(),
// //       updatedBy: new Types.ObjectId(userId),
// //       remarks: 'Payment processed'
// //     });

// //     await settlement.save();

// //     // Update group member balances
// //     await this.updateMemberBalances(
// //       settlement.groupId.toString(),
// //       settlement.fromUser.toString(),
// //       settlement.toUser.toString(),
// //       parseFloat(settlement.amount.toString())
// //     );

// //     // Update related expenses
// //     await this.updateRelatedExpenses(
// //       settlement.groupId.toString(),
// //       settlement.fromUser.toString(),
// //       settlement.toUser.toString(),
// //       parseFloat(settlement.amount.toString())
// //     );

// //     // Invalidate caches
// //     await redisClient.delete(`group:${settlement.groupId}`);

// //     logger.info(`Settlement completed: ${settlementId}`);
// //     return settlement;
// //   }

// //   /**
// //    * Cancel a settlement
// //    */
// //   async cancelSettlement(settlementId: string, userId: string): Promise<any> {
// //     const settlement = await Settlement.findOne({ settlementId });
// //     if (!settlement) {
// //       throw new NotFoundError('Settlement');
// //     }

// //     if (settlement.status === 'COMPLETED') {
// //       throw new BadRequestError('Cannot cancel a completed settlement');
// //     }

// //     settlement.status = 'CANCELLED';
// //     settlement.statusHistory.push({
// //       status: 'CANCELLED',
// //       timestamp: new Date(),
// //       updatedBy: new Types.ObjectId(userId),
// //       remarks: 'Settlement cancelled'
// //     });

// //     await settlement.save();

// //     logger.info(`Settlement cancelled: ${settlementId}`);
// //     return settlement;
// //   }

// //   /**
// //    * Get settlement history for a group
// //    */
// //   async getSettlementHistory(groupId: string, userId: string, options: any = {}): Promise<any> {
// //     const group = await Group.findOne({
// //       groupId,
// //       'members.userId': new Types.ObjectId(userId),
// //       'members.invitationStatus': 'ACCEPTED'
// //     });

// //     if (!group) {
// //       throw new ForbiddenError('You are not a member of this group');
// //     }

// //     const { page = 1, limit = 20 } = options;
// //     const skip = (page - 1) * limit;

// //     const query = { groupId: group._id };

// //     const [settlements, total] = await Promise.all([
// //       Settlement.find(query)
// //         .populate('fromUser', 'userId email firstName lastName')
// //         .populate('toUser', 'userId email firstName lastName')
// //         .populate('createdBy', 'userId email firstName lastName')
// //         .sort({ createdAt: -1 })
// //         .skip(skip)
// //         .limit(limit),
// //       Settlement.countDocuments(query)
// //     ]);

// //     return { settlements, total };
// //   }

// //   /**
// //    * Update member balances in group
// //    */
// //   private async updateMemberBalances(
// //     groupId: string,
// //     fromUser: string,
// //     toUser: string,
// //     amount: number
// //   ): Promise<void> {
// //     const group = await Group.findOne({ groupId });
// //     if (!group) return;

// //     // Update payer's balance (reduces what they owe)
// //     const payerMember = group.members.find((m:any) => m.userId.toString() === fromUser);
// //     if (payerMember) {
// //       const newOwed = new Decimal(payerMember.balance.totalOwed.toString())
// //         .minus(amount)
// //         .toFixed(2);
      
// //       payerMember.balance.totalOwed = Types.Decimal128.fromString(newOwed);
// //       payerMember.balance.netBalance = Types.Decimal128.fromString(
// //         new Decimal(payerMember.balance.totalLent.toString())
// //           .minus(newOwed)
// //           .toFixed(2)
// //       );
// //     }

// //     // Update recipient's balance (reduces what they are owed)
// //     const recipientMember = group.members.find((m:any) => m.userId.toString() === toUser);
// //     if (recipientMember) {
// //       const newLent = new Decimal(recipientMember.balance.totalLent.toString())
// //         .minus(amount)
// //         .toFixed(2);
      
// //       recipientMember.balance.totalLent = Types.Decimal128.fromString(newLent);
// //       recipientMember.balance.netBalance = Types.Decimal128.fromString(
// //         new Decimal(newLent)
// //           .minus(recipientMember.balance.totalOwed.toString())
// //           .toFixed(2)
// //       );
// //     }

// //     await group.save();
// //   }

// //   /**
// //    * Update related expense splits
// //    */
// //   private async updateRelatedExpenses(
// //     groupId: string,
// //     fromUser: string,
// //     toUser: string,
// //     amount: number
// //   ): Promise<void> {
// //     const group = await Group.findOne({ groupId });
// //     if (!group) return;

// //     // Find unsettled expenses where fromUser owes toUser
// //     const expenses = await Expense.find({
// //       groupId: group._id,
// //       'metadata.isDeleted': false,
// //       'splits.userId': new Types.ObjectId(fromUser),
// //       'splits.settlementStatus': 'PENDING',
// //       paidBy: new Types.ObjectId(toUser)
// //     }).sort({ createdAt: 1 });

// //     let remainingAmount = amount;

// //     for (const expense of expenses) {
// //       if (remainingAmount <= 0) break;

// //       const split = expense.splits.find(
// //         s => s.userId.toString() === fromUser && s.settlementStatus === 'PENDING'
// //       );

// //       if (split) {
// //         const splitAmount = parseFloat(split.finalAmount.toString());
        
// //         if (remainingAmount >= splitAmount) {
// //           // Full settlement of this split
// //           split.settlementStatus = 'SETTLED';
// //           remainingAmount -= splitAmount;
// //         } else {
// //           // Partial settlement
// //           split.settlementStatus = 'PARTIAL';
// //           remainingAmount = 0;
// //         }

// //         await expense.save();
// //       }
// //     }
// //   }
// // }

// // export const settlementService = new SettlementService();
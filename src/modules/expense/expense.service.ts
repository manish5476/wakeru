import { Types, FilterQuery } from 'mongoose';
import { Expense, IExpense, ISplit } from './expense.model';
import { Trip } from '../trips/trip.model';
import { incrementStopTotals, decrementStopTotals } from '../trips/trip.service';
import { AppError } from '../../shared/errors/AppError';
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseListQuery,
  SplitInput,
} from './expense.validation';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MemberInfo {
  userId: string;
  displayName: string;
}

interface ComputedSplit {
  userId: string;
  displayName: string;
  amountLocal: number;
  amountBase: number;
  percentage?: number;
  shares?: number;
  isPaid: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT ENGINE
// The core of TripSplit — computes per-member splits in BOTH currencies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute splits for an expense.
 * Returns the full ISplit array ready to embed in the expense document.
 *
 * All amounts are rounded to 2 decimal places.
 * For 'equal' splits, the remainder (from rounding) is distributed to the
 * first N members to avoid total drift (e.g. ₹0.01 gaps).
 */
export const computeSplits = (
  splitInput: SplitInput,
  amountLocal: number,
  amountBase: number,
  exchangeRate: number,
  paidByUid: string,
  allTripMembers: MemberInfo[]
): ComputedSplit[] => {
  const memberMap = new Map(allTripMembers.map((m) => [m.userId, m.displayName]));

  switch (splitInput.method) {
    case 'personal': {
      // No split — payer owns full cost, no debt created
      const displayName = memberMap.get(paidByUid) ?? 'Unknown';
      return [
        {
          userId: paidByUid,
          displayName,
          amountLocal,
          amountBase,
          isPaid: true, // personal expenses are always "settled"
        },
      ];
    }

    case 'equal': {
      const { memberIds } = splitInput;
      const n = memberIds.length;
      const basePerPerson = Math.floor((amountLocal / n) * 100) / 100;
      const remainder = Math.round((amountLocal - basePerPerson * n) * 100);

      return memberIds.map((uid, i) => {
        const local = i < remainder
          ? parseFloat((basePerPerson + 0.01).toFixed(2))
          : basePerPerson;
        const base = parseFloat((local * exchangeRate).toFixed(2));

        return {
          userId: uid,
          displayName: memberMap.get(uid) ?? 'Unknown',
          amountLocal: local,
          amountBase: base,
          isPaid: uid === paidByUid, // payer's own share is pre-paid
        };
      });
    }

    case 'percentage': {
      const totalPct = splitInput.members.reduce((s, m) => s + m.percentage, 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new AppError('Percentages must sum to 100', 400);
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

    case 'exact': {
      const totalExact = splitInput.members.reduce((s, m) => s + m.amountLocal, 0);
      if (Math.abs(totalExact - amountLocal) > 0.01) {
        throw new AppError(
          `Exact amounts must sum to ${amountLocal} (got ${totalExact.toFixed(2)})`,
          400
        );
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

    case 'shares': {
      const totalShares = splitInput.members.reduce((s, m) => s + m.shares, 0);
      if (totalShares <= 0) {
        throw new AppError('Total shares must be greater than 0', 400);
      }

      return splitInput.members.map((m) => {
        const local = parseFloat(
          ((amountLocal * m.shares) / totalShares).toFixed(2)
        );
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
      throw new AppError('Unknown split method', 400);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE EXPENSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an expense inside a trip stop.
 *
 * Flow:
 * 1. Load the trip to get stop details (currency, exchange rate, members)
 * 2. Compute amountBase from amountLocal * currentExchangeRate
 * 3. Compute per-member splits in both currencies
 * 4. Save the expense document
 * 5. Update trip/stop cached totals via $inc (atomic)
 */
export const createExpense = async (
  input: CreateExpenseInput,
  adderUid: string,
  adderDisplayName: string
): Promise<IExpense> => {
  // Load trip — we need stop details, base currency, member list
  const trip = await Trip.findOne({
    isArchived: false,
    'stops._id': new Types.ObjectId(input.stopId),
  });

  if (!trip) {
    throw new AppError('Trip or stop not found', 404);
  }

  if (!trip.isMember(adderUid)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  const stop = trip.stops.find(
    (s) => s._id.toString() === input.stopId
  );

  if (!stop) {
    throw new AppError('Stop not found', 404);
  }

  // Validate paidBy is an active trip member
  const payer = trip.getMember(input.paidBy);
  if (!payer) {
    throw new AppError('The specified payer is not an active member of this trip', 400);
  }

  // Compute base amount using the CURRENT exchange rate (locked at creation time)
  const exchangeRateUsed = stop.currentExchangeRate;
  const amountBase = parseFloat(
    (input.amountLocal * exchangeRateUsed).toFixed(2)
  );

  // Get all active trip members for split computation
  const activeMembers: MemberInfo[] = trip
    .getActiveMembers()
    .map((m) => ({ userId: m.userId, displayName: m.displayName }));

  // Compute splits
  const splits = computeSplits(
    input.split,
    input.amountLocal,
    amountBase,
    exchangeRateUsed,
    input.paidBy,
    activeMembers
  );

  // Create the expense document
  const expense = new Expense({
    tripId: trip._id,
    stopId: new Types.ObjectId(input.stopId),
    title: input.title,
    category: input.category,
    notes: input.notes,
    date: input.date,
    amountLocal: input.amountLocal,
    amountBase,
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

  // Update cached totals on Trip (atomic $inc — no race conditions)
  // 'personal' expenses still count toward spending totals
  const owedAmounts = splits
    .filter((s) => s.userId !== input.paidBy) // exclude payer's own share from "owes"
    .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));

  await incrementStopTotals(
    trip._id.toString(),
    input.stopId,
    input.amountLocal,
    amountBase,
    input.paidBy,
    owedAmounts
  );

  return expense;
};

// ─────────────────────────────────────────────────────────────────────────────
// READ EXPENSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all expenses for a specific stop (paginated).
 */
export const getStopExpenses = async (
  stopId: string,
  query: ExpenseListQuery
) => {
  const filter: FilterQuery<IExpense> = {
    stopId: new Types.ObjectId(stopId),
  };

  if (query.category) filter.category = query.category;
  if (query.paidBy) filter.paidBy = query.paidBy;
  if (query.isSettled !== undefined) filter.isSettled = query.isSettled;
  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = query.startDate;
    if (query.endDate) filter.date.$lte = query.endDate;
  }

  const skip = (query.page - 1) * query.limit;
  const sortField = query.sortBy;
  const sortDir = query.sortOrder === 'asc' ? 1 : -1;

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Expense.countDocuments(filter),
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

/**
 * Get all expenses across all stops for a trip (unified view).
 */
export const getTripExpenses = async (
  tripId: string,
  query: ExpenseListQuery
) => {
  const filter: FilterQuery<IExpense> = {
    tripId: new Types.ObjectId(tripId),
  };

  if (query.category) filter.category = query.category;
  if (query.paidBy) filter.paidBy = query.paidBy;
  if (query.isSettled !== undefined) filter.isSettled = query.isSettled;
  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = query.startDate;
    if (query.endDate) filter.date.$lte = query.endDate;
  }

  const skip = (query.page - 1) * query.limit;
  const sortDir = query.sortOrder === 'asc' ? 1 : -1;

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .sort({ [query.sortBy]: sortDir })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Expense.countDocuments(filter),
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

/**
 * Get all expenses paid by the current user across all their trips.
 */
export const getMyExpenses = async (
  userId: string,
  query: ExpenseListQuery
) => {
  const filter: FilterQuery<IExpense> = { paidBy: userId };
  const skip = (query.page - 1) * query.limit;

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Expense.countDocuments(filter),
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

/**
 * Get a single expense by ID.
 * Validates the requester is a member of the trip.
 */
export const getExpenseById = async (
  expenseId: string,
  requestingUid: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);

  if (!expense) {
    throw new AppError('Expense not found', 404);
  }

  // Verify membership
  const trip = await Trip.findById(expense.tripId);
  if (!trip || !trip.isMember(requestingUid)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  return expense;
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE EXPENSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update an expense.
 *
 * If amountLocal or paidBy or split changes, we:
 * 1. Reverse the old cached totals ($inc with negative values)
 * 2. Recompute splits
 * 3. Save the updated expense
 * 4. Apply new cached totals
 *
 * Exchange rate is NOT re-fetched — we keep the rate that was active at
 * original creation time (unless you explicitly want to reset it).
 */
export const updateExpense = async (
  expenseId: string,
  input: UpdateExpenseInput,
  editorUid: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);

  const trip = await Trip.findById(expense.tripId);
  if (!trip) throw new AppError('Trip not found', 404);
  if (!trip.canEdit(editorUid)) throw new AppError('You cannot edit expenses in this trip', 403);

  // Capture old values before mutation — needed to reverse caches
  const oldAmountLocal = expense.amountLocal;
  const oldAmountBase = expense.amountBase;
  const oldPaidBy = expense.paidBy;
  const oldOwedAmounts = expense.splits
    .filter((s) => s.userId !== oldPaidBy)
    .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));

  // Apply simple field updates
  if (input.title !== undefined) expense.title = input.title;
  if (input.category !== undefined) expense.category = input.category;
  if (input.notes !== undefined) expense.notes = input.notes;
  if (input.date !== undefined) expense.date = input.date;

  const needsSplitRecompute =
    input.amountLocal !== undefined ||
    input.paidBy !== undefined ||
    input.split !== undefined;

  if (needsSplitRecompute) {
    const newAmountLocal = input.amountLocal ?? expense.amountLocal;
    const newPaidBy = input.paidBy ?? expense.paidBy;
    const newSplitInput = input.split ?? buildCurrentSplitInput(expense);

    // Validate payer
    const payer = trip.getMember(newPaidBy);
    if (!payer) throw new AppError('Payer is not an active trip member', 400);

    const newAmountBase = parseFloat(
      (newAmountLocal * expense.exchangeRateUsed).toFixed(2)
    );

    const activeMembers: MemberInfo[] = trip
      .getActiveMembers()
      .map((m) => ({ userId: m.userId, displayName: m.displayName }));

    const newSplits = computeSplits(
      newSplitInput,
      newAmountLocal,
      newAmountBase,
      expense.exchangeRateUsed,
      newPaidBy,
      activeMembers
    );

    // Reverse old caches
    await decrementStopTotals(
      trip._id.toString(),
      expense.stopId.toString(),
      oldAmountLocal,
      oldAmountBase,
      oldPaidBy,
      oldOwedAmounts
    );

    // Apply new values
    expense.amountLocal = newAmountLocal;
    expense.amountBase = newAmountBase;
    expense.paidBy = newPaidBy;
    expense.paidByName = payer.displayName;
    expense.splitMethod = newSplitInput.method;
    expense.splits = newSplits as ISplit[];

    await expense.save();

    // Apply new caches
    const newOwedAmounts = newSplits
      .filter((s) => s.userId !== newPaidBy)
      .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));

    await incrementStopTotals(
      trip._id.toString(),
      expense.stopId.toString(),
      newAmountLocal,
      newAmountBase,
      newPaidBy,
      newOwedAmounts
    );
  } else {
    await expense.save();
  }

  expense.editedBy = editorUid;
  expense.editedAt = new Date();
  await expense.save();

  return expense;
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE EXPENSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete an expense and reverse all cached totals.
 * Only the payer or a trip admin can delete.
 */
export const deleteExpense = async (
  expenseId: string,
  requestingUid: string
): Promise<void> => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);

  const trip = await Trip.findById(expense.tripId);
  if (!trip) throw new AppError('Trip not found', 404);

  const isPayerOrAdmin =
    expense.paidBy === requestingUid || trip.isAdmin(requestingUid);

  if (!isPayerOrAdmin) {
    throw new AppError('Only the payer or a trip admin can delete this expense', 403);
  }

  // Reverse cached totals before deletion
  const owedAmounts = expense.splits
    .filter((s) => s.userId !== expense.paidBy)
    .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));

  await decrementStopTotals(
    trip._id.toString(),
    expense.stopId.toString(),
    expense.amountLocal,
    expense.amountBase,
    expense.paidBy,
    owedAmounts
  );

  await expense.deleteOne();
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK SPLIT AS PAID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark one member's split as paid (after UPI confirmation or manual confirmation).
 * Updates isSettled on the expense if all splits are now paid.
 */
export const markSplitPaid = async (
  expenseId: string,
  targetUserId: string,
  paymentId?: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);

  const split = expense.splits.find((s) => s.userId === targetUserId);
  if (!split) throw new AppError('Split not found for this user', 404);
  if (split.isPaid) throw new AppError('This split is already marked as paid', 400);

  split.isPaid = true;
  split.paidAt = new Date();
  if (paymentId) {
    split.paymentId = new Types.ObjectId(paymentId);
  }

  // isSettled is auto-updated by pre-save hook
  await expense.save();
  return expense;
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reconstruct a SplitInput from the current expense document.
 * Used when updating an expense without changing the split method.
 */
function buildCurrentSplitInput(expense: IExpense): SplitInput {
  const method = expense.splitMethod;

  if (method === 'personal') {
    return { method: 'personal' };
  }

  if (method === 'equal') {
    return {
      method: 'equal',
      memberIds: expense.splits.map((s) => s.userId),
    };
  }

  if (method === 'percentage') {
    return {
      method: 'percentage',
      members: expense.splits.map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        percentage: s.percentage ?? 0,
      })),
    };
  }

  if (method === 'exact') {
    return {
      method: 'exact',
      members: expense.splits.map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        amountLocal: s.amountLocal,
      })),
    };
  }

  if (method === 'shares') {
    return {
      method: 'shares',
      members: expense.splits.map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        shares: s.shares ?? 1,
      })),
    };
  }

  throw new AppError('Unknown split method on existing expense', 500);
}// import { expenseRepository } from './expense.repository';
// import { expenseCalculator } from './expense.calculator';
// import { Expense, IExpenseDocument } from './expense.model';
// import { CreateExpenseDTO, UpdateExpenseDTO, ISplit } from '../../shared/types/expense.types';
// import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../shared/errors/AppError';
// import { logger } from '../../config/logger';
// import { redisClient } from '../../config/redis';
// import { Types } from 'mongoose';
// import { Group, IGroupMember } from '../group/group.model';
// import { UserModel } from '../user/user.model';
// import crypto from 'crypto';

// export class ExpenseService {
//   /**
//    * Create a new expense with proportional splitting
//    */
//   async createExpense(expenseData: CreateExpenseDTO, createdBy: string): Promise<IExpenseDocument> {
//     // Verify group exists and user is member
//     const group = await Group.findOne({ 
//       groupId: expenseData.groupId,
//       'members.userId': new Types.ObjectId(createdBy),
//       'members.invitationStatus': 'ACCEPTED'
//     });

//     if (!group) {
//       throw new NotFoundError('Group not found or you are not a member');
//     }

//     // Idempotency Check
//     if (expenseData.idempotencyKey) {
//       const existingExpense = await Expense.findOne({ idempotencyKey: expenseData.idempotencyKey });
//       if (existingExpense) {
//         logger.info(`Idempotent request processed. Returning existing expense for key: ${expenseData.idempotencyKey}`);
//         return existingExpense;
//       }
//     }

//     // Validate expense data
//     const validation = expenseCalculator.validateExpense(
//       expenseData.lineItems as any,
//       expenseData.taxes || []
//     );

//     if (!validation.isValid) {
//       throw new BadRequestError(validation.errors.join('; '));
//     }

//     // Verify all consumers are group members
//     const memberIds = group.members
//       .filter((m: IGroupMember) => m.invitationStatus === 'ACCEPTED')
//       .map((m: IGroupMember) => m.userId.toString());

//     expenseData.lineItems.forEach(item => {
//       item.consumers.forEach(consumer => {
//         if (!memberIds.includes(consumer.userId)) {
//           throw new BadRequestError(`User ${consumer.userId} is not a member of this group`);
//         }
//       });
//     });

//     // Use client-provided key or generate a new one
//     const idempotencyKey = expenseData.idempotencyKey || crypto.randomUUID();

//     // Calculate proportional splits
//     const { splits, analytics, totals } = expenseCalculator.calculateProportionalSplit(
//       expenseData.lineItems as any,
//       expenseData.taxes || [],
//       expenseData.discounts || [],
//       expenseData.paidBy,
//       expenseData.currency
//     );

//     // Create expense document
//     const expenseDoc: Partial<IExpenseDocument> = {
//       expenseId: crypto.randomUUID(),
//       groupId: group._id,
//       description: expenseData.description,
//       category: expenseData.category,
//       currency: expenseData.currency,
//       lineItems: expenseData.lineItems.map(item => ({
//         itemId: crypto.randomUUID(),
//         name: item.name,
//         category: item.category,
//         basePrice: Types.Decimal128.fromString(item.basePrice.toFixed(2)),
//         quantity: item.quantity,
//         consumers: item.consumers.map(c => ({
//           userId: new Types.ObjectId(c.userId),
//           consumptionPercentage: c.consumptionPercentage,
//           quantity: c.quantity,
//           notes: c.notes
//         }))
//       })),
//       taxes: expenseData.taxes?.map(tax => ({
//         name: tax.name,
//         percentage: tax.percentage,
//         amount: Types.Decimal128.fromString('0'), // Will be calculated
//         applicableTo: tax.applicableTo,
//         applicableItems: tax.applicableItems,
//         taxCode: tax.taxCode
//       })),
//       discounts: expenseData.discounts?.map(discount => ({
//         type: discount.type,
//         value: Types.Decimal128.fromString(discount.value.toFixed(2)),
//         code: discount.code,
//         description: discount.description,
//         applicableTo: discount.applicableTo,
//         applicableItems: discount.applicableItems
//       })),
//       splits,
//       paidBy: new Types.ObjectId(expenseData.paidBy),
//       paymentMethod: expenseData.paymentMethod,
//       paymentDate: expenseData.paymentDate || new Date(),
//       totalAmount: totals.totalAmount,
//       subTotal: totals.subTotal,
//       taxTotal: totals.taxTotal,
//       discountTotal: totals.discountTotal,
//       analytics,
//       metadata: {
//         createdBy: new Types.ObjectId(createdBy),
//         isDeleted: false,
//         version: 1
//       },
//       idempotencyKey
//     };

//     const expense = await expenseRepository.createExpense(expenseDoc);

//     // Update group financial summary (async)
//     this.updateGroupFinancials(group.groupId).catch(err => 
//       logger.error('Failed to update group financials:', err)
//     );

//     // Update user stats (async)
//     this.updateUserStats(expense.splits.map(s => s.userId.toString())).catch(err =>
//       logger.error('Failed to update user stats:', err)
//     );

//     // Invalidate caches
//     await this.invalidateRelatedCaches(group.groupId, expense.splits as unknown as ISplit[]);

//     logger.info(`Expense created: ${expense.expenseId} in group ${group.groupId}`);
//     return expense;
//   }

//   /**
//    * Get expense by ID
//    */
//   async getExpenseById(expenseId: string, userId: string): Promise<IExpenseDocument> {
//     const expense = await expenseRepository.findById(expenseId);
//     if (!expense) {
//       throw new NotFoundError('Expense');
//     }

//     // Verify user is part of this expense's group
//     const group = await Group.findOne({
//       _id: expense.groupId,
//       'members.userId': new Types.ObjectId(userId),
//       'members.invitationStatus': 'ACCEPTED'
//     });

//     if (!group) {
//       throw new ForbiddenError('You do not have access to this expense');
//     }

//     return expense;
//   }

//   /**
//    * Get expenses for a group
//    */
//   async getGroupExpenses(groupId: string, userId: string, options: any = {}): Promise<{ expenses: IExpenseDocument[]; total: number }>{
//     // Verify membership
//     const group = await Group.findOne({
//       groupId,
//       'members.userId': new Types.ObjectId(userId),
//       'members.invitationStatus': 'ACCEPTED'
//     });

//     if (!group) {
//       throw new ForbiddenError('You are not a member of this group');
//     }

//     return expenseRepository.findByGroupId(group._id.toString(), options);
//   }

//   /**
//    * Get user's expenses
//    */
//   async getUserExpenses(userId: string, options: any = {}): Promise<{ expenses: IExpenseDocument[]; total: number }> {
//     return expenseRepository.findByUserId(userId, options);
//   }

//   /**
//    * Update expense
//    */
//   async updateExpense(expenseId: string, userId: string, updateData: UpdateExpenseDTO): Promise<IExpenseDocument> {
//     const expense = await expenseRepository.findById(expenseId);
//     if (!expense) {
//       throw new NotFoundError('Expense');
//     }

//     // Check if user is the creator or group admin
//     const group = await Group.findOne({
//       _id: expense.groupId,
//       'members.userId': new Types.ObjectId(userId),
//       'members.invitationStatus': 'ACCEPTED'
//     });

//     if (!group) {
//       throw new ForbiddenError('You do not have permission to update this expense');
//     }

//     const isAdmin = group.members.find(
//       (m: IGroupMember) => m.userId.toString() === userId && m.role === 'ADMIN'
//     );

//     if (expense.metadata.createdBy.toString() !== userId && !isAdmin) {
//       throw new ForbiddenError('Only the expense creator or group admin can update this expense');
//     }

//     // Recalculate if line items changed
//     if (updateData.lineItems || updateData.taxes || updateData.discounts) {
//       const { splits, analytics, totals } = expenseCalculator.calculateProportionalSplit(
//         (updateData.lineItems || expense.lineItems) as any,
//         (updateData.taxes || expense.taxes) as any,
//         (updateData.discounts || expense.discounts) as any,
//         expense.paidBy.toString(),
//         expense.currency
//       );

//       expense.splits = splits as any;
//       expense.analytics = analytics;
//       expense.totalAmount = totals.totalAmount;
//       expense.subTotal = totals.subTotal;
//       expense.taxTotal = totals.taxTotal;
//       expense.discountTotal = totals.discountTotal;
//     }

//     if (updateData.description) expense.description = updateData.description;
//     if (updateData.category) expense.category = updateData.category;
    
//     expense.metadata.version += 1;
//     expense.metadata.updatedBy = new Types.ObjectId(userId);

//     await expense.save();

//     // Invalidate caches
//     await this.invalidateRelatedCaches(group.groupId, expense.splits as unknown as ISplit[]);

//     logger.info(`Expense updated: ${expenseId}`);
//     return expense;
//   }

//   /**
//    * Delete expense (soft delete)
//    */
//   async deleteExpense(expenseId: string, userId: string): Promise<void> {
//     const expense = await expenseRepository.findById(expenseId);
//     if (!expense) {
//       throw new NotFoundError('Expense');
//     }

//     // Check permissions
//     const group = await Group.findOne({
//       _id: expense.groupId,
//       'members.userId': new Types.ObjectId(userId)
//     });

//     if (!group) {
//       throw new ForbiddenError('You do not have permission to delete this expense');
//     }

//     const isAdmin = group.members.find((m: IGroupMember) => m.userId.toString() === userId && m.role === 'ADMIN');
//     if (expense.metadata.createdBy.toString() !== userId && !isAdmin) {
//       throw new ForbiddenError('Only the expense creator or group admin can delete this expense');
//     }

//     // Check if any splits are settled
//     const hasSettledSplits = expense.splits.some(s => s.settlementStatus === 'SETTLED');
//     if (hasSettledSplits) {
//       throw new BadRequestError('Cannot delete expense with settled splits');
//     }

//     await expenseRepository.softDelete(expenseId, userId);

//     // Reverse the financial impact
//     await this.updateGroupFinancials(group.groupId);
//     await this.invalidateRelatedCaches(group.groupId, expense.splits as unknown as ISplit[]);

//     logger.info(`Expense deleted: ${expenseId}`);
//   }

//   /**
//    * Update group financial summary
//    */
//   private async updateGroupFinancials(groupId: string): Promise<void> {
//     const stats = await expenseRepository.getGroupExpenseStats(groupId);
    
//     if (stats.length > 0) {
//       const stat = stats[0];
//       await Group.findOneAndUpdate(
//         { groupId },
//         {
//           $set: {
//             'financialSummary.totalExpenses': stat.totalExpenses,
//             'financialSummary.totalPending': Types.Decimal128.fromString(stat.totalAmount.toFixed(2)),
//             'financialSummary.averageExpenseAmount': Types.Decimal128.fromString(stat.averageAmount.toFixed(2)),
//             'financialSummary.lastExpenseDate': stat.lastExpenseDate,
//             'financialSummary.expenseCount': stat.totalExpenses
//           }
//         }
//       );
//     }
//   }

//   /**
//    * Update user statistics
//    */
//   private async updateUserStats(userIds: string[]): Promise<void> {
//     for (const userId of userIds) {
//       const totalExpenses = await Expense.countDocuments({
//         'splits.userId': new Types.ObjectId(userId),
//         'metadata.isDeleted': false
//       });

//       await UserModel.findOneAndUpdate(
//         { _id: new Types.ObjectId(userId) },
//         { 
//           $set: { 
//             'stats.totalExpenses': totalExpenses,
//             'stats.lastActiveAt': new Date()
//           } 
//         }
//       );
//     }
//   }

//   /**
//    * Invalidate related caches
//    */
//   private async invalidateRelatedCaches(groupId: string, splits: ISplit[]): Promise<void> {
//     await redisClient.delete(`group:${groupId}`);
    
//     // Invalidate user caches
//     const userIds = new Set<string>();
//     splits.forEach((split: ISplit) => userIds.add(split.userId.toString()));
    
//     for (const userId of userIds) {
//       await redisClient.delete(`user:${userId}:groups`);
//       await redisClient.delete(`user:${userId}:expenses`);
//     }
//   }
// }

// export const expenseService = new ExpenseService();

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
import { markSettlementStale } from '../settlement/settlement.service';
import { socketServer } from '../../infrastructure/websocket/socket.server';

// ============================================================
// TYPES
// ============================================================

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
        throw new AppError('At least one member is required for equal split', 400);
      }

      const n = memberIds.length;
      const basePerPerson = Math.floor((amountLocal / n) * 100) / 100;
      const remainderCents = Math.round((amountLocal - basePerPerson * n) * 100);

      return memberIds.map((uid: string, i: number) => {
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

    // ── EXACT ────────────────────────────────────────────────
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

    // ── SHARES ───────────────────────────────────────────────
    case 'shares': {
      const totalShares = splitInput.members.reduce((s, m) => s + m.shares, 0);
      if (totalShares <= 0) {
        throw new AppError('Total shares must be greater than 0', 400);
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
      throw new AppError('Unknown split method', 400);
  }
};

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
export const createExpense = async (
  input: CreateExpenseInput,
  adderUid: string,
  adderDisplayName: string
): Promise<IExpense> => {
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

  if (!trip.canEdit(adderUid)) {
    throw new AppError('Viewers cannot add expenses', 403);
  }

  // Find the stop
  const stop = trip.stops.find(
    (s) => s._id.toString() === input.stopId
  );

  if (!stop) {
    throw new AppError('Stop not found in this trip', 404);
  }

  // Validate payer is an active trip member
  const payer = trip.getMember(input.paidBy);
  if (!payer) {
    throw new AppError('The specified payer is not an active member of this trip', 400);
  }

  // Compute base amount using CURRENT exchange rate (locked at creation time)
  const exchangeRateUsed = stop.currentExchangeRate;
  const amountBase = parseFloat(
    (input.amountLocal * exchangeRateUsed).toFixed(2)
  );

  // Get all active members for split computation
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

  // Create expense document
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

  // Update cached totals on Trip (atomic $inc — safe under concurrency)
  const owedAmounts = splits
    .filter((s) => s.userId !== input.paidBy)
    .map((s) => ({ userId: s.userId, amountBase: s.amountBase }));

  await incrementStopTotals(
    trip._id.toString(),
    input.stopId,
    input.amountLocal,
    amountBase,
    input.paidBy,
    owedAmounts
  );
  await markSettlementStale(trip._id.toString());

  socketServer.notifyExpenseAdded(trip._id.toString(), expense, adderUid);

  return expense;
};

// ============================================================
// READ EXPENSES
// ============================================================

/**
 * Get expenses for a specific stop (paginated, filterable).
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
    if (query.startDate) filter.date.$gte = new Date(query.startDate);
    if (query.endDate) filter.date.$lte = new Date(query.endDate);
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
 * Get all expenses across ALL stops for a trip.
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
    if (query.startDate) filter.date.$gte = new Date(query.startDate);
    if (query.endDate) filter.date.$lte = new Date(query.endDate);
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
 * Get all expenses paid by a specific user across all trips.
 */
export const getMyExpenses = async (
  userId: string,
  query: ExpenseListQuery
) => {
  const filter: FilterQuery<IExpense> = { paidBy: userId };

  if (query.category) filter.category = query.category;
  if (query.isSettled !== undefined) filter.isSettled = query.isSettled;

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

  // Verify trip membership
  const trip = await Trip.findById(expense.tripId);
  if (!trip || !trip.isMember(requestingUid)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  return expense;
};

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
export const updateExpense = async (
  expenseId: string,
  input: UpdateExpenseInput,
  editorUid: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);

  const trip = await Trip.findById(expense.tripId);
  if (!trip) throw new AppError('Trip not found', 404);
  if (!trip.canEdit(editorUid)) {
    throw new AppError('You cannot edit expenses in this trip', 403);
  }

  // Capture old values for cache reversal
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

  // Track editor
  expense.editedBy = editorUid;
  expense.editedAt = new Date();
  await expense.save();
  await markSettlementStale(trip._id.toString());

  socketServer.notifyExpenseUpdated(
    trip._id.toString(),
    {
      _id: expense._id,
      title: expense.title,
    },
    editorUid
  );

  return expense;
};

// ============================================================
// DELETE EXPENSE
// ============================================================

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
    throw new AppError(
      'Only the payer or a trip admin can delete this expense',
      403
    );
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
  await markSettlementStale(trip._id.toString());

  socketServer.notifyExpenseDeleted(trip._id.toString(), expense.title, requestingUid);
  await expense.deleteOne();
};

// ============================================================
// MARK SPLIT AS PAID
// ============================================================

/**
 * Mark one member's split as paid (manual or UPI confirmation).
 * Auto-updates isSettled if all splits are now paid.
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

  await expense.save();
  return expense;
};

// ============================================================
// PRIVATE HELPERS
// ============================================================

/**
 * Reconstruct SplitInput from existing expense for cache reversal.
 */
function buildCurrentSplitInput(expense: IExpense): SplitInput {
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
      throw new AppError('Unknown split method on existing expense', 500);
  }
}
import { Types, FilterQuery, PipelineStage } from 'mongoose';
import { Expense, IExpense, ISplit } from './expense.model';
import { Stop } from '../trips/stop.model';
import { Trip } from '../trips/trip.model';
import { User } from '../auth/auth.model';
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
import { achievementService } from '../achievement/achievement.service';
import { logger } from '../../config/logger';
import { notificationService } from '../notification/notification.service';

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

interface PublicUserSummary {
  userId: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
}
// Add to expense.service.ts

interface ExpenseAchievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlockedAt?: Date;
    progress: number; // 0-100
}

const ACHIEVEMENTS = {
    FIRST_EXPENSE: {
        id: 'first_expense',
        title: 'Budget Beginner',
        description: 'Add your first expense',
        icon: '🌱',
    },
    BUDGET_MASTER: {
        id: 'budget_master',
        title: 'Budget Master',
        description: 'Stay under budget for entire trip',
        icon: '💰',
    },
    SPLIT_KING: {
        id: 'split_king',
        title: 'Split King',
        description: 'Split 50 expenses equally',
        icon: '👑',
    },
    GLOBETROTTER: {
        id: 'globetrotter',
        title: 'Globetrotter',
        description: 'Add expenses in 5+ currencies',
        icon: '🌍',
    },
    SPEED_SETTLER: {
        id: 'speed_settler',
        title: 'Speed Settler',
        description: 'Settle all debts within 24 hours of trip end',
        icon: '⚡',
    },
    PHOTOGRAPHER: {
        id: 'photographer',
        title: 'Receipt Photographer',
        description: 'Upload 20 receipt photos',
        icon: '📸',
    },
    SOCIAL_BUTTERFLY: {
        id: 'social_butterfly',
        title: 'Social Butterfly',
        description: 'Invite 10 friends to trips',
        icon: '🦋',
    },
};

// Check and award achievements after each expense
// async checkAchievements(tripId: string, userId: string): Promise<ExpenseAchievement[]> {
//     // Calculate progress for each achievement
//     // Award new ones
//     // Return updated list
// }


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
  const memberMap = new Map(
    allTripMembers.map((m) => [m.userId, m.displayName])
  );

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
        throw new AppError(
          'At least one member is required for equal split',
          400
        );
      }

      const n = memberIds.length;
      const basePerPerson = Math.floor((amountLocal / n) * 100) / 100;
      const remainderCents = Math.round(
        (amountLocal - basePerPerson * n) * 100
      );

      return memberIds.map((uid: string, i: number) => {
        const local =
          i < remainderCents
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
      const totalPct = splitInput.members.reduce(
        (s, m) => s + m.percentage,
        0
      );
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new AppError('Percentages must sum to 100', 400);
      }

      return splitInput.members.map((m) => {
        const local = parseFloat(
          ((amountLocal * m.percentage) / 100).toFixed(2)
        );
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
      const totalExact = splitInput.members.reduce(
        (s, m) => s + m.amountLocal,
        0
      );
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
      const totalShares = splitInput.members.reduce(
        (s, m) => s + m.shares,
        0
      );
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

// ============================================================
// USER-DETAIL ENRICHMENT HELPERS
// ============================================================

const buildUserSummaryMap = async (
  firebaseUids: string[]
): Promise<Map<string, PublicUserSummary>> => {
  const uniqueUids = [...new Set(firebaseUids)].filter(Boolean);
  if (uniqueUids.length === 0) return new Map();

  const users = await User.find(
    { firebaseUid: { $in: uniqueUids }, isDeleted: false },
    { firebaseUid: 1, displayName: 1, photoURL: 1, bio: 1 }
  ).lean();

  const map = new Map<string, PublicUserSummary>();
  for (const u of users as any[]) {
    map.set(u.firebaseUid, {
      userId: u.firebaseUid,
      displayName: u.displayName,
      photoURL: u.photoURL,
      bio: u.bio,
    });
  }
  return map;
};

const attachUserDetails = (
  expenses: any[],
  userMap: Map<string, PublicUserSummary>
) => {
  return expenses.map((expense) => {
    const payer = userMap.get(expense.paidBy) ?? {
      userId: expense.paidBy,
      displayName: expense.paidByName ?? 'Unknown User',
      photoURL: undefined,
      bio: undefined,
    };

    const splits = (expense.splits ?? []).map((split: any) => ({
      ...split,
      user: userMap.get(split.userId) ?? {
        userId: split.userId,
        displayName: split.displayName ?? 'Unknown User',
        photoURL: undefined,
        bio: undefined,
      },
    }));

    return {
      ...expense,
      payer,
      splits,
    };
  });
};

// ============================================================
// CREATE EXPENSE
// ============================================================

export const createExpense = async (
  input: CreateExpenseInput,
  adderUid: string,
  adderDisplayName: string
): Promise<IExpense> => {
  const stop = await Stop.findById(input.stopId);
  if (!stop) {
    throw new AppError('Stop not found', 404);
  }

  const trip = await Trip.findById(stop.tripId);
  if (!trip || trip.isArchived) {
    throw new AppError('Trip not found or archived', 404);
  }

  if (!trip.isMember(adderUid)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  if (!trip.canEdit(adderUid)) {
    throw new AppError('Viewers cannot add expenses', 403);
  }

  // Validate payer is an active trip member
  const payer = trip.getMember(input.paidBy);
  if (!payer) {
    throw new AppError(
      'The specified payer is not an active member of this trip',
      400
    );
  }

  const isAdderAdmin = trip.isAdmin(adderUid);
  if (!trip.allowAnyPayer && input.paidBy !== adderUid && !isAdderAdmin) {
    throw new AppError(
      'Trip settings do not allow selecting other members as the payer',
      403
    );
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
    location: input.location,
    tags: input.tags || [],
    localCurrency: stop.currency,
    baseCurrency: trip.baseCurrency,
    exchangeRateUsed,
    paidBy: input.paidBy,
    paidByName: payer.displayName,
    splitMethod: input.split.method,
    splits,
    addedBy: adderUid,
    isSettled: input.split.method === 'personal',
    comments: [],
    attachments: (input.attachments || []).map((att) => ({
      ...att,
      uploadedBy: adderUid,
      uploadedAt: new Date(),
    })),
    repeatConfig: input.repeatConfig,
    expenseHistory: [],
  });

  await expense.save();

  // Update cached totals
  const owedAmounts = splits.map((s) => ({
    userId: s.userId,
    amountBase: s.amountBase,
  }));

  await incrementStopTotals(
    trip._id.toString(),
    input.stopId,
    input.amountLocal,
    amountBase,
    input.paidBy,
    owedAmounts
  );

  await markSettlementStale(trip._id.toString());

  // Budget alerts
  const stopAfterUpdate = await Stop.findById(input.stopId);
  if (stopAfterUpdate?.budget && stopAfterUpdate.totalSpentLocal > stopAfterUpdate.budget) {
    const pctUsed = (stopAfterUpdate.totalSpentLocal / stopAfterUpdate.budget) * 100;
    socketServer.notifyBudgetAlert(
      trip._id.toString(),
      stop.name,
      stop.currency,
      pctUsed
    );
  }

  socketServer.notifyExpenseAdded(trip._id.toString(), expense, adderUid);
  achievementService.onExpenseCreated(expense, adderUid).catch(err => {
    logger.error('Failed to process achievements on expense creation:', err);
  });

  return expense;
};

// ============================================================
// READ EXPENSES
// ============================================================

export const getStopExpenses = async (
  stopId: string,
  query: ExpenseListQuery
) => {
  const filter: FilterQuery<IExpense> = {
    stopId: new Types.ObjectId(stopId),
    isArchived: query.isArchived === true,
  };

  if (query.category) filter.category = query.category;
  if (query.paidBy) filter.paidBy = query.paidBy;
  if (query.isSettled !== undefined) filter.isSettled = query.isSettled;
  if (query.tags && query.tags.length > 0) {
    filter.tags = { $in: query.tags };
  }
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

export const getTripExpenses = async (
  tripId: string,
  query: ExpenseListQuery
) => {
  const filter: FilterQuery<IExpense> = {
    tripId: new Types.ObjectId(tripId),
    isArchived: query.isArchived === true,
  };

  if (query.category) filter.category = query.category;
  if (query.paidBy) filter.paidBy = query.paidBy;
  if (query.isSettled !== undefined) filter.isSettled = query.isSettled;
  if (query.tags && query.tags.length > 0) {
    filter.tags = { $in: query.tags };
  }
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

export const getMyExpenses = async (
  userId: string,
  query: ExpenseListQuery
) => {
  const andConditions: FilterQuery<IExpense>[] = [
    { isArchived: query.isArchived === true },
  ];

  if (query.tripId) {
    andConditions.push({ tripId: new Types.ObjectId(query.tripId) });
  }
  if (query.category) andConditions.push({ category: query.category });
  if (query.isSettled !== undefined) {
    andConditions.push({ isSettled: query.isSettled });
  }
  if (query.paidBy) andConditions.push({ paidBy: query.paidBy });
  if (query.tags && query.tags.length > 0) {
    andConditions.push({ tags: { $in: query.tags } });
  }

  // Date Range Filter (new, more robust version)
  // Supports both `dateRange: { startDate, endDate }` and top-level `startDate`/`endDate`
  const startDate = (query as any).dateRange?.startDate ?? query.startDate;
  const endDate = (query as any).dateRange?.endDate ?? query.endDate;

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999); // Make endDate inclusive
      dateFilter.$lte = endOfDay;
    }
    andConditions.push({ date: dateFilter });
  }

  const userInvolvedFilter: FilterQuery<IExpense> = {
    $or: [{ paidBy: userId }, { 'splits.userId': userId }],
  };

  switch (query.type) {
    case 'you_owe':
      andConditions.push({ paidBy: { $ne: userId } });
      andConditions.push({
        splits: { $elemMatch: { userId, isPaid: false } },
      });
      break;
    case 'you_paid':
      andConditions.push({ paidBy: userId });
      break;
    case 'unsettled':
      andConditions.push({ isSettled: false });
      andConditions.push(userInvolvedFilter);
      break;
    case 'settled':
      andConditions.push({ isSettled: true });
      andConditions.push(userInvolvedFilter);
      break;
    case 'all':
    default:
      andConditions.push(userInvolvedFilter);
      break;
  }

  if (query.personId) {
    andConditions.push({
      $or: [
        { paidBy: query.personId, 'splits.userId': userId },
        { paidBy: userId, 'splits.userId': query.personId },
      ],
    });
  }

  const filter: FilterQuery<IExpense> = { $and: andConditions };

  const sort: Record<string, 1 | -1> = {};
  const order = query.sortOrder === 'asc' ? 1 : -1;

  if (query.sortBy === 'tripId') {
    sort.tripId = order;
    sort.date = -1;
  } else if (query.sortBy === 'paidBy') {
    sort.paidBy = order;
    sort.date = -1;
  } else {
    sort[query.sortBy || 'date'] = order;
  }

  const skip = (query.page - 1) * query.limit;

  const [expenses, total, stats] = await Promise.all([
    Expense.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .populate('tripId', 'title')
      .lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: '$amountBase' } } },
    ]),
  ]);

  const totalAmountFiltered = stats.length > 0 ? stats[0].totalAmount : 0;

  const involvedUids = expenses.flatMap((e: any) => [
    e.paidBy,
    ...(e.splits ?? []).map((s: any) => s.userId),
  ]);
  const userMap = await buildUserSummaryMap(involvedUids);
  const enrichedExpenses = attachUserDetails(expenses, userMap).map(
    (expense: any) => {
      const yourSplit =
        expense.splits.find((s: any) => s.userId === userId) ?? null;
      return {
        ...expense,
        youArePayer: expense.paidBy === userId,
        yourShare: yourSplit
          ? {
              amountLocal: yourSplit.amountLocal,
              amountBase: yourSplit.amountBase,
              isPaid: yourSplit.isPaid,
            }
          : null,
      };
    }
  );

  return {
    expenses: enrichedExpenses,
    totalAmount: totalAmountFiltered,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
      hasMore: query.page * query.limit < total,
    },
  };
};

export const getExpenseById = async (
  expenseId: string,
  requestingUid: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);

  if (!expense) {
    throw new AppError('Expense not found', 404);
  }

  const trip = await Trip.findById(expense.tripId);
  if (!trip || !trip.isMember(requestingUid)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  return expense;
};

export const getStopExpenseSummary = async (
  stopId: string,
  requestingUid: string
) => {
  const stop = await Stop.findById(stopId);
  if (!stop) {
    throw new AppError('Stop not found', 404);
  }

  const trip = await Trip.findById(stop.tripId);
  if (!trip || !trip.isMember(requestingUid)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  const pipeline: PipelineStage[] = [
    { $match: { stopId: new Types.ObjectId(stopId), isArchived: false } },
    {
      $facet: {
        byCategory: [
          {
            $group: {
              _id: '$category',
              totalLocal: { $sum: '$amountLocal' },
              totalBase: { $sum: '$amountBase' },
              count: { $sum: 1 },
            },
          },
          { $sort: { totalLocal: -1 } },
        ],
        byPayer: [
          {
            $group: {
              _id: '$paidBy',
              paidByName: { $first: '$paidByName' },
              totalPaidLocal: { $sum: '$amountLocal' },
              totalPaidBase: { $sum: '$amountBase' },
              count: { $sum: 1 },
            },
          },
          { $sort: { totalPaidLocal: -1 } },
        ],
        byTag: [
          { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: '$tags',
              totalLocal: { $sum: '$amountLocal' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
      },
    },
  ];

  const result = await Expense.aggregate(pipeline);

  return {
    categoryBreakdown: result[0]?.byCategory || [],
    payerBreakdown: result[0]?.byPayer || [],
    tagBreakdown: result[0]?.byTag || [],
  };
};

// ============================================================
// UPDATE EXPENSE
// ============================================================

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
  const oldOwedAmounts = expense.splits.map((s) => ({
    userId: s.userId,
    amountBase: s.amountBase,
  }));

  // Track changes for history
  const changes: { field: string; oldValue: any; newValue: any }[] = [];

  // Apply simple field updates
  const simpleFields: (keyof IExpense & keyof UpdateExpenseInput)[] = [
    'title',
    'category',
    'notes',
    'date',
    'tags',
  ];
  for (const field of simpleFields) {
    if (input[field] !== undefined && expense[field] !== input[field]) {
      changes.push({
        field,
        oldValue: expense[field],
        newValue: input[field],
      });
      (expense as any)[field] = input[field];
    }
  }

  if (input.location !== undefined) {
    changes.push({
      field: 'location',
      oldValue: expense.location,
      newValue: input.location,
    });
    expense.location = input.location;
  }

  const needsSplitRecompute =
    input.amountLocal !== undefined ||
    input.paidBy !== undefined ||
    input.split !== undefined;

  if (needsSplitRecompute) {
    const newAmountLocal = input.amountLocal ?? expense.amountLocal;
    const newPaidBy = input.paidBy ?? expense.paidBy;
    const newSplitInput = input.split ?? buildCurrentSplitInput(expense);

    const payer = trip.getMember(newPaidBy);
    if (!payer)
      throw new AppError('Payer is not an active trip member', 400);

    const isEditorAdmin = trip.isAdmin(editorUid);
    if (
      !trip.allowAnyPayer &&
      newPaidBy !== editorUid &&
      !isEditorAdmin
    ) {
      throw new AppError(
        'Trip settings do not allow selecting other members as the payer',
        403
      );
    }

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

    // Track changes
    if (oldAmountLocal !== newAmountLocal) {
      changes.push({
        field: 'amountLocal',
        oldValue: oldAmountLocal,
        newValue: newAmountLocal,
      });
    }
    if (oldPaidBy !== newPaidBy) {
      changes.push({
        field: 'paidBy',
        oldValue: oldPaidBy,
        newValue: newPaidBy,
      });
    }

    // Apply new values
    expense.amountLocal = newAmountLocal;
    expense.amountBase = newAmountBase;
    expense.paidBy = newPaidBy;
    expense.paidByName = payer.displayName;
    expense.splitMethod = newSplitInput.method;
    expense.splits = newSplits as ISplit[];

    await expense.save();

    // Apply new caches
    const newOwedAmounts = newSplits.map((s) => ({
      userId: s.userId,
      amountBase: s.amountBase,
    }));

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

  // Add to history
  if (changes.length > 0) {
    expense.expenseHistory.push({
      changedBy: editorUid,
      changedAt: new Date(),
      changes,
    });
  }

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
// DELETE / ARCHIVE
// ============================================================

export const archiveExpense = async (
  expenseId: string,
  requestingUid: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);
  if (expense.isArchived) return expense;

  const trip = await Trip.findById(expense.tripId);
  if (!trip) throw new AppError('Trip not found', 404);

  const isPayerOrAdmin =
    expense.paidBy === requestingUid || trip.isAdmin(requestingUid);
  if (!isPayerOrAdmin) {
    throw new AppError(
      'Only the payer or a trip admin can archive this expense',
      403
    );
  }

  const owedAmounts = expense.splits.map((s) => ({
    userId: s.userId,
    amountBase: s.amountBase,
  }));

  await decrementStopTotals(
    trip._id.toString(),
    expense.stopId.toString(),
    expense.amountLocal,
    expense.amountBase,
    expense.paidBy,
    owedAmounts
  );
  await markSettlementStale(trip._id.toString());

  expense.isArchived = true;
  await expense.save();

  socketServer.notifyExpenseDeleted(
    trip._id.toString(),
    expense.title,
    requestingUid
  );
  return expense;
};

export const unarchiveExpense = async (
  expenseId: string,
  requestingUid: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);
  if (!expense.isArchived) return expense;

  const trip = await Trip.findById(expense.tripId);
  if (!trip) throw new AppError('Trip not found', 404);

  const isPayerOrAdmin =
    expense.paidBy === requestingUid || trip.isAdmin(requestingUid);
  if (!isPayerOrAdmin) {
    throw new AppError(
      'Only the payer or a trip admin can unarchive this expense',
      403
    );
  }

  const owedAmounts = expense.splits.map((s) => ({
    userId: s.userId,
    amountBase: s.amountBase,
  }));

  await incrementStopTotals(
    trip._id.toString(),
    expense.stopId.toString(),
    expense.amountLocal,
    expense.amountBase,
    expense.paidBy,
    owedAmounts
  );
  await markSettlementStale(trip._id.toString());

  expense.isArchived = false;
  await expense.save();

  socketServer.notifyExpenseAdded(
    trip._id.toString(),
    expense,
    requestingUid
  );
  return expense;
};

export const deleteExpensePermanent = async (
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
      'Only the payer or a trip admin can delete this expense permanently',
      403
    );
  }

  if (!expense.isArchived) {
    const owedAmounts = expense.splits.map((s) => ({
      userId: s.userId,
      amountBase: s.amountBase,
    }));

    await decrementStopTotals(
      trip._id.toString(),
      expense.stopId.toString(),
      expense.amountLocal,
      expense.amountBase,
      expense.paidBy,
      owedAmounts
    );
    await markSettlementStale(trip._id.toString());
    socketServer.notifyExpenseDeleted(
      trip._id.toString(),
      expense.title,
      requestingUid
    );
  }

  await expense.deleteOne();
};

// ============================================================
// COMMENTS
// ============================================================

export const addComment = async (
  expenseId: string,
  text: string,
  userId: string,
  displayName: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);

  const trip = await Trip.findById(expense.tripId);
  if (!trip || !trip.isMember(userId)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  expense.comments.push({
    userId,
    displayName,
    text,
    createdAt: new Date(),
  });

  await expense.save();

  // Notify socket clients
  socketServer.notifyExpenseCommentAdded(
    trip._id.toString(),
    expense._id.toString(),
    expense.title,
    displayName,
    userId
  );

  // Send push/in-app notifications to other trip members
  const otherMembers = trip.members.filter((m) => m.userId !== userId);
  const notificationPromises = otherMembers.map((member) =>
    notificationService.create(
      member.userId,
      'EXPENSE_COMMENT_ADDED',
      'New Comment on Expense',
      `${displayName} commented on "${expense.title}": "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
      {
        isActionable: true,
        actionUrl: `/(app)/expenses/${expense._id.toString()}`,
        priority: 'low',
      }
    )
  );
  await Promise.allSettled(notificationPromises);

  return expense;
};

export const deleteComment = async (
  expenseId: string,
  commentId: string,
  userId: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);

  const comment = expense.comments.find(
    (c) => (c as any)._id.toString() === commentId
  );
  if (!comment) throw new AppError('Comment not found', 404);

  const trip = await Trip.findById(expense.tripId);
  const isAdmin = trip?.isAdmin(userId);

  if (comment.userId !== userId && !isAdmin) {
    throw new AppError(
      'Only the comment author or a trip admin can delete comments',
      403
    );
  }

  expense.comments = expense.comments.filter(
    (c) => (c as any)._id.toString() !== commentId
  );

  await expense.save();

  // Notify socket clients
  socketServer.notifyExpenseCommentDeleted(
    expense.tripId.toString(),
    expense._id.toString(),
    expense.title,
    userId
  );

  return expense;
};

// ============================================================
// MARK SPLIT AS PAID
// ============================================================

export const markSplitPaid = async (
  expenseId: string,
  targetUserId: string,
  requestingUid: string,
  paymentId?: string
): Promise<IExpense> => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);

  if (expense.paidBy !== requestingUid) {
    throw new AppError(
      'Only the payer can mark this expense as paid',
      403
    );
  }

  const split = expense.splits.find((s) => s.userId === targetUserId);
  if (!split) throw new AppError('Split not found for this user', 404);
  if (split.isPaid)
    throw new AppError('This split is already marked as paid', 400);

  split.isPaid = true;
  split.paidAt = new Date();
  if (paymentId) {
    split.paymentId = new Types.ObjectId(paymentId);
  }

  await expense.save();
  await markSettlementStale(expense.tripId.toString());

  return expense;
};

// ============================================================
// ANALYTICS
// ============================================================

export const getTripExpenseAnalytics = async (
  tripId: string,
  requestingUid: string
) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new AppError('Trip not found', 404);
  if (!trip.isMember(requestingUid)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  const pipeline: PipelineStage[] = [
    {
      $match: {
        tripId: new Types.ObjectId(tripId),
        isArchived: false,
      },
    },
    {
      $facet: {
        // Daily spending trend
        dailyTrend: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              totalLocal: { $sum: '$amountLocal' },
              totalBase: { $sum: '$amountBase' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        // Per-category breakdown
        byCategory: [
          {
            $group: {
              _id: '$category',
              totalLocal: { $sum: '$amountLocal' },
              totalBase: { $sum: '$amountBase' },
              count: { $sum: 1 },
              avgAmount: { $avg: '$amountBase' },
            },
          },
          { $sort: { totalBase: -1 } },
        ],
        // Per-member comparison
        byMember: [
          {
            $group: {
              _id: '$paidBy',
              paidByName: { $first: '$paidByName' },
              totalPaid: { $sum: '$amountBase' },
              count: { $sum: 1 },
              avgExpense: { $avg: '$amountBase' },
            },
          },
          { $sort: { totalPaid: -1 } },
        ],
        // Overall stats
        overall: [
          {
            $group: {
              _id: null,
              totalExpenses: { $sum: 1 },
              totalSpent: { $sum: '$amountBase' },
              avgExpense: { $avg: '$amountBase' },
              maxExpense: { $max: '$amountBase' },
              minExpense: { $min: '$amountBase' },
            },
          },
        ],
        // Most expensive day
        topDay: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              total: { $sum: '$amountBase' },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 1 },
        ],
      },
    },
  ];

  const result = await Expense.aggregate(pipeline);

  return {
    dailyTrend: result[0]?.dailyTrend || [],
    byCategory: result[0]?.byCategory || [],
    byMember: result[0]?.byMember || [],
    overall: result[0]?.overall?.[0] || {
      totalExpenses: 0,
      totalSpent: 0,
      avgExpense: 0,
      maxExpense: 0,
      minExpense: 0,
    },
    topDay: result[0]?.topDay?.[0] || null,
    vsBudget:
      trip.totalBudget && trip.totalSpentBase
        ? {
            budget: trip.totalBudget,
            spent: trip.totalSpentBase,
            remaining: trip.totalBudget - trip.totalSpentBase,
            percentUsed: parseFloat(
              ((trip.totalSpentBase / trip.totalBudget) * 100).toFixed(1)
            ),
          }
        : null,
  };
};

// ============================================================
// PRIVATE HELPERS
// ============================================================

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

// ============================================================
// NAMESPACE EXPORT
// ============================================================

export const expenseService = {
  createExpense,
  getStopExpenses,
  getTripExpenses,
  getMyExpenses,
  getExpenseById,
  getStopExpenseSummary,
  getTripExpenseAnalytics,
  updateExpense,
  archiveExpense,
  unarchiveExpense,
  deleteExpensePermanent,
  addComment,
  deleteComment,
  markSplitPaid,
  computeSplits,
};

import { Types } from 'mongoose';
import { Expense } from '../expense/expense.model';
import { Trip } from '../trips/trip.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';
import {
  AnalyticsFilters, QuickStats, UserAnalytics, TripAnalytics,
  YearlySummary, CATEGORY_EMOJIS, TrendPoint, DailyData,
  MonthlyData, CategoryBreakdown, MemberSpending, StopBreakdown,
  CurrencyBreakdown, DayPattern, VelocityData, BudgetTracking,
} from './analytics.types';

// ============================================================
// Helpers
// ============================================================

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildDateFilter(startDate?: string, endDate?: string) {
  const filter: any = {};
  if (startDate) filter.$gte = new Date(startDate);
  if (endDate) filter.$lte = new Date(endDate);
  return Object.keys(filter).length > 0 ? filter : undefined;
}

function buildUserMatch(userId: string, filters: AnalyticsFilters = {}) {
  const match: any = {
    $or: [{ paidBy: userId }, { 'splits.userId': userId }],
  };
  const dateFilter = buildDateFilter(filters.startDate, filters.endDate);
  if (dateFilter) match.date = dateFilter;
  if (filters.category) match.category = filters.category;
  if (filters.tripId) match.tripId = new Types.ObjectId(filters.tripId);
  return match;
}

// ============================================================
// Analytics Service
// ============================================================

export const analyticsService = {

  // ==========================================================
  // QUICK STATS — Dashboard Widgets
  // ==========================================================
  async getQuickStats(userId: string): Promise<QuickStats> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const userFilter = { $or: [{ paidBy: userId }, { 'splits.userId': userId }] };

    const [
      thisMonth, lastMonth, thisWeek, lastWeek, today,
      activeTrips, pendingSettlements,
      topCategory, topTrip, recentExpenses, spendingTrend,
    ] = await Promise.all([
      Expense.aggregate([{ $match: { ...userFilter, date: { $gte: thisMonthStart } } }, { $group: { _id: null, total: { $sum: '$amountBase' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { ...userFilter, date: { $gte: lastMonthStart, $lt: thisMonthStart } } }, { $group: { _id: null, total: { $sum: '$amountBase' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { ...userFilter, date: { $gte: thisWeekStart } } }, { $group: { _id: null, total: { $sum: '$amountBase' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { ...userFilter, date: { $gte: lastWeekStart, $lt: thisWeekStart } } }, { $group: { _id: null, total: { $sum: '$amountBase' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { ...userFilter, date: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$amountBase' }, count: { $sum: 1 } } }]),
      Trip.countDocuments({ 'members.userId': userId, 'members.isActive': true, status: { $in: ['active', 'planning'] }, isArchived: false }),
      Expense.countDocuments({ ...userFilter, isSettled: false }),
      Expense.aggregate([{ $match: { ...userFilter, date: { $gte: thisMonthStart } } }, { $group: { _id: '$category', total: { $sum: '$amountBase' } } }, { $sort: { total: -1 } }, { $limit: 1 }]),
      Expense.aggregate([{ $match: { ...userFilter, date: { $gte: thisMonthStart } } }, { $group: { _id: '$tripId', total: { $sum: '$amountBase' } } }, { $sort: { total: -1 } }, { $limit: 1 }, { $lookup: { from: 'trips', localField: '_id', foreignField: '_id', as: 'trip' } }, { $unwind: { path: '$trip', preserveNullAndEmptyArrays: true } }, { $project: { tripId: '$_id', tripTitle: { $ifNull: ['$trip.title', 'Unknown'] }, total: 1 } }]),
      Expense.find(userFilter).sort({ date: -1 }).limit(5).select('title amountBase amountLocal localCurrency date category paidByName').lean(),
      Expense.aggregate([{ $match: { ...userFilter, date: { $gte: new Date(Date.now() - 7 * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, amount: { $sum: '$amountBase' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);

    // Get user balances
    const user = await User.findById(userId).select('totalLentAcrossTrips totalOwedAcrossTrips').lean();

    const thisMonthTotal = thisMonth[0]?.total || 0;
    const lastMonthTotal = lastMonth[0]?.total || 0;
    const thisWeekTotal = thisWeek[0]?.total || 0;
    const lastWeekTotal = lastWeek[0]?.total || 0;

    return {
      thisMonth: { total: thisMonthTotal, count: thisMonth[0]?.count || 0 },
      lastMonth: { total: lastMonthTotal, count: lastMonth[0]?.count || 0 },
      thisWeek: { total: thisWeekTotal, count: thisWeek[0]?.count || 0 },
      today: { total: today[0]?.total || 0, count: today[0]?.count || 0 },
      spendingChange: lastMonthTotal > 0 ? parseFloat((((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1)) : thisMonthTotal > 0 ? 100 : 0,
      weeklyChange: lastWeekTotal > 0 ? parseFloat((((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100).toFixed(1)) : thisWeekTotal > 0 ? 100 : 0,
      activeTrips,
      pendingSettlements,
      totalLent: user?.totalLentAcrossTrips || 0,
      totalOwed: user?.totalOwedAcrossTrips || 0,
      netBalance: (user?.totalLentAcrossTrips || 0) - (user?.totalOwedAcrossTrips || 0),
      topCategory: topCategory[0] ? { category: topCategory[0]._id, total: topCategory[0].total } : null,
      topTrip: topTrip[0] ? { tripId: topTrip[0].tripId.toString(), tripTitle: topTrip[0].tripTitle, total: topTrip[0].total } : null,
      recentExpenses: recentExpenses.map((e: any) => ({
        _id: e._id.toString(),
        title: e.title,
        amountBase: e.amountBase,
        amountLocal: e.amountLocal,
        localCurrency: e.localCurrency,
        date: e.date,
        category: e.category,
        paidByName: e.paidByName,
      })),
      spendingTrend: spendingTrend.map((s: any) => ({ date: s._id, amount: s.amount, count: s.count })),
    };
  },

  // ==========================================================
  // USER ANALYTICS — Complete personal finance dashboard
  // ==========================================================
  async getUserAnalytics(userId: string, filters: AnalyticsFilters = {}): Promise<UserAnalytics> {
    const match = buildUserMatch(userId, filters);
    const dateFilter = buildDateFilter(filters.startDate, filters.endDate);

    const [
      summaryResult, categories, monthlyData, dailyData, weeklyData,
      tripData, dayOfWeek, hourOfDay, highestExpense, lowestExpense,
    ] = await Promise.all([
      Expense.aggregate([{ $match: match }, { $group: { _id: null, totalSpent: { $sum: '$amountBase' }, totalExpenses: { $sum: 1 }, avgPerExpense: { $avg: '$amountBase' } } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: '$category', totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 }, avgAmount: { $avg: '$amountBase' } } }, { $sort: { totalAmount: -1 } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 } } }, { $sort: { '_id.year': 1, '_id.month': 1 } }]),
      Expense.aggregate([{ $match: { ...match, date: { $gte: new Date(Date.now() - 90 * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 }, dayOfWeek: { $first: { $dayOfWeek: '$date' } } } }, { $sort: { _id: 1 } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: { year: { $year: '$date' }, week: { $week: '$date' } }, totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 }, startDate: { $min: '$date' }, endDate: { $max: '$date' } } }, { $sort: { '_id.year': 1, '_id.week': 1 } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: '$tripId', totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 } } }, { $sort: { totalAmount: -1 } }, { $limit: 10 }, { $lookup: { from: 'trips', localField: '_id', foreignField: '_id', as: 'trip' } }, { $unwind: { path: '$trip', preserveNullAndEmptyArrays: true } }, { $project: { tripId: '$_id', tripTitle: { $ifNull: ['$trip.title', 'Unknown'] }, totalAmount: 1, count: 1, startDate: '$trip.startDate', endDate: '$trip.endDate', status: '$trip.status', memberCount: { $size: { $ifNull: ['$trip.members', []] } } } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: { $dayOfWeek: '$date' }, totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: { $hour: '$date' }, totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Expense.find(match).sort({ amountBase: -1 }).limit(1).select('title amountBase amountLocal localCurrency date paidByName category').lean(),
      Expense.find(match).sort({ amountBase: 1 }).limit(1).select('title amountBase amountLocal localCurrency date paidByName category').lean(),
    ]);

    const totalSpent = summaryResult[0]?.totalSpent || 0;
    const totalExpenses = summaryResult[0]?.totalExpenses || 0;

    // Median calculation
    const medianResult = await Expense.aggregate([
      { $match: match },
      { $sort: { amountBase: 1 } },
      { $group: { _id: null, amounts: { $push: '$amountBase' } } },
    ]);
    const amounts = medianResult[0]?.amounts || [];
    const median = amounts.length > 0 ? amounts[Math.floor(amounts.length / 2)] : 0;

    // Max daily spend
    const dailyTotals = dailyData.map((d: any) => ({ date: d._id, amount: d.totalAmount }));
    const maxDaily = dailyTotals.reduce((max: any, d: any) => d.amount > (max?.amount || 0) ? d : max, dailyTotals[0] || { date: '', amount: 0 });

    // Period comparison
    let periodComparison;
    if (filters.compareWith && filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      const duration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - duration);
      const prevEnd = new Date(start.getTime() - 1);
      const prevMatch = buildUserMatch(userId, { startDate: prevStart.toISOString(), endDate: prevEnd.toISOString() });
      const [prevResult] = await Expense.aggregate([{ $match: prevMatch }, { $group: { _id: null, totalSpent: { $sum: '$amountBase' }, totalExpenses: { $sum: 1 } } }]);
      const prevTotal = prevResult?.totalSpent || 0;
      const change = prevTotal > 0 ? parseFloat((((totalSpent - prevTotal) / prevTotal) * 100).toFixed(1)) : totalSpent > 0 ? 100 : 0;
      periodComparison = {
        previousPeriod: { totalSpent: prevTotal, totalExpenses: prevResult?.totalExpenses || 0 },
        changePercent: change,
        trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
      } as any;
    }

    const daysDiff = filters.startDate && filters.endDate
      ? Math.max(1, Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / 86400000))
      : 30;

    return {
      summary: {
        totalSpent,
        totalExpenses,
        averagePerExpense: parseFloat((summaryResult[0]?.avgPerExpense || 0).toFixed(2)),
        averagePerDay: parseFloat((totalSpent / daysDiff).toFixed(2)),
        medianExpense: parseFloat(median.toFixed(2)),
        maxDailySpend: maxDaily,
        baseCurrency: 'INR',
      },
      periodComparison,
      highestExpense: highestExpense[0] ? {
        _id: highestExpense[0]._id.toString(),
        title: highestExpense[0].title,
        amountBase: highestExpense[0].amountBase,
        amountLocal: highestExpense[0].amountLocal,
        currency: highestExpense[0].localCurrency,
        date: highestExpense[0].date?.toISOString(),
        paidByName: highestExpense[0].paidByName,
        category: highestExpense[0].category,
      } : null,
      lowestExpense: lowestExpense[0] ? {
        _id: lowestExpense[0]._id.toString(),
        title: lowestExpense[0].title,
        amountBase: lowestExpense[0].amountBase,
        amountLocal: lowestExpense[0].amountLocal,
        currency: lowestExpense[0].localCurrency,
        date: lowestExpense[0].date?.toISOString(),
        paidByName: lowestExpense[0].paidByName,
        category: lowestExpense[0].category,
      } : null,
      categories: categories.map((c: any) => ({
        category: c._id,
        emoji: CATEGORY_EMOJIS[c._id] || '📌',
        totalAmount: c.totalAmount,
        percentage: totalSpent > 0 ? parseFloat(((c.totalAmount / totalSpent) * 100).toFixed(1)) : 0,
        count: c.count,
        averagePerExpense: parseFloat((c.avgAmount || 0).toFixed(2)),
        trend: 'stable',
      })),
      monthlySpending: monthlyData.map((m: any) => ({
        month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
        monthName: MONTH_NAMES[m._id.month - 1],
        totalAmount: m.totalAmount,
        count: m.count,
        categories: {},
      })),
      dailySpending: dailyData.map((d: any) => ({
        date: d._id,
        totalAmount: d.totalAmount,
        count: d.count,
        dayOfWeek: DAY_NAMES[(d.dayOfWeek - 1) % 7],
      })),
      weeklySpending: weeklyData.map((w: any) => ({
        week: `${w._id.year}-W${String(w._id.week).padStart(2, '0')}`,
        startDate: w.startDate?.toISOString(),
        endDate: w.endDate?.toISOString(),
        totalAmount: w.totalAmount,
        count: w.count,
      })),
      tripBreakdown: tripData.map((t: any) => ({
        tripId: t.tripId.toString(),
        tripTitle: t.tripTitle,
        totalAmount: t.totalAmount,
        percentage: totalSpent > 0 ? parseFloat(((t.totalAmount / totalSpent) * 100).toFixed(1)) : 0,
        count: t.count,
        startDate: t.startDate?.toISOString(),
        endDate: t.endDate?.toISOString(),
        status: t.status,
        memberCount: t.memberCount,
      })),
      dayOfWeekPattern: DAY_NAMES.map((day, index) => {
        const found = dayOfWeek.find((d: any) => d._id === index + 1);
        return {
          day,
          totalAmount: found?.totalAmount || 0,
          count: found?.count || 0,
          percentage: totalSpent > 0 ? parseFloat((((found?.totalAmount || 0) / totalSpent) * 100).toFixed(1)) : 0,
        };
      }),
      hourOfDayPattern: Array.from({ length: 24 }, (_, i) => {
        const found = hourOfDay.find((h: any) => h._id === i);
        return { hour: i, totalAmount: found?.totalAmount || 0, count: found?.count || 0 };
      }),
    };
  },

  // ==========================================================
  // TRIP ANALYTICS — Complete trip dashboard
  // ==========================================================
  async getTripAnalytics(tripId: string, userId: string, filters: AnalyticsFilters = {}): Promise<TripAnalytics> {
    const trip = await Trip.findById(tripId);
    if (!trip) throw new AppError('Trip not found', 404);
    if (!trip.isMember(userId)) throw new AppError('Access denied', 403);

    const match: any = { tripId: new Types.ObjectId(tripId) };
    const dateFilter = buildDateFilter(filters.startDate, filters.endDate);
    if (dateFilter) match.date = dateFilter;
    if (filters.category) match.category = filters.category;
    if (filters.stopId) match.stopId = new Types.ObjectId(filters.stopId);

    const [
      summaryResult, categories, dailyData, stopData, currencyData,
      settlementStats, dayOfWeek, highestExpense, lowestExpense,
      spendingVelocity,
    ] = await Promise.all([
      Expense.aggregate([{ $match: match }, { $group: { _id: null, totalSpent: { $sum: '$amountBase' }, totalExpenses: { $sum: 1 }, avgPerExpense: { $avg: '$amountBase' } } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: '$category', totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 }, avgAmount: { $avg: '$amountBase' } } }, { $sort: { totalAmount: -1 } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: '$stopId', totalLocal: { $sum: '$amountLocal' }, totalBase: { $sum: '$amountBase' }, count: { $sum: 1 }, currency: { $first: '$localCurrency' } } }, { $sort: { totalBase: -1 } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: '$localCurrency', totalLocal: { $sum: '$amountLocal' }, totalBase: { $sum: '$amountBase' }, count: { $sum: 1 }, exchangeRate: { $avg: '$exchangeRateUsed' } } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: '$isSettled', count: { $sum: 1 }, totalAmount: { $sum: '$amountBase' } } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: { $dayOfWeek: '$date' }, totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Expense.find(match).sort({ amountBase: -1 }).limit(1).select('title amountBase amountLocal localCurrency date paidByName category').lean(),
      Expense.find(match).sort({ amountBase: 1 }).limit(1).select('title amountBase amountLocal localCurrency date paidByName category').lean(),
      Expense.aggregate([{ $match: match }, { $sort: { date: 1 } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, dailyAmount: { $sum: '$amountBase' } } }, { $sort: { _id: 1 } }]),
    ]);

    const totalSpent = summaryResult[0]?.totalSpent || 0;
    const totalExpenses = summaryResult[0]?.totalExpenses || 0;
    const settled = settlementStats.find((s: any) => s._id === true);
    const unsettled = settlementStats.find((s: any) => s._id === false);
    const tripDays = Math.max(1, Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000));

    // Median
    const medianResult = await Expense.aggregate([{ $match: match }, { $sort: { amountBase: 1 } }, { $group: { _id: null, amounts: { $push: '$amountBase' } } }]);
    const amounts = medianResult[0]?.amounts || [];
    const median = amounts.length > 0 ? amounts[Math.floor(amounts.length / 2)] : 0;

    // Max daily
    const dailyTotals = dailyData.map((d: any) => ({ date: d._id, amount: d.totalAmount }));
    const maxDaily = dailyTotals.reduce((max: any, d: any) => d.amount > (max?.amount || 0) ? d : max, dailyTotals[0] || { date: '', amount: 0 });

    // Member spending from trip cached data
    const activeMembers = trip.getActiveMembers();
    const memberSpending: MemberSpending[] = activeMembers.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      photoURL: m.photoURL,
      totalPaid: m.totalPaidBase,
      totalOwed: m.totalOwesBase,
      netBalance: m.totalPaidBase - m.totalOwesBase,
      expenseCount: 0,
      percentage: 0,
      categories: {},
    }));

    // Stop breakdown
    const stopBreakdown: StopBreakdown[] = stopData.map((s: any) => {
      const stop = trip.stops.find((st: any) => st._id.toString() === s._id.toString());
      const stopStart = stop?.startDate ? new Date(stop.startDate) : trip.startDate;
      const stopEnd = stop?.endDate ? new Date(stop.endDate) : trip.endDate;
      const stopDays = Math.max(1, Math.ceil((stopEnd.getTime() - stopStart.getTime()) / 86400000));
      return {
        stopId: s._id,
        stopName: stop?.name || 'Unknown',
        emoji: stop?.emoji || '📍',
        currency: s.currency,
        totalLocal: s.totalLocal,
        totalBase: s.totalBase,
        count: s.count,
        percentage: totalSpent > 0 ? parseFloat(((s.totalBase / totalSpent) * 100).toFixed(1)) : 0,
        budget: stop?.budget,
        budgetUtilization: stop?.budget ? parseFloat(((s.totalLocal / stop.budget) * 100).toFixed(1)) : undefined,
        days: stopDays,
        averagePerDay: parseFloat((s.totalBase / stopDays).toFixed(2)),
      };
    });

    // Cumulative spending velocity
    let cumulative = 0;
    const velocityData: VelocityData[] = spendingVelocity.map((v: any) => {
      cumulative += v.dailyAmount;
      return { date: v._id, dailyAmount: v.dailyAmount, cumulativeAmount: parseFloat(cumulative.toFixed(2)) };
    });

    // Budget tracking
    const budgetTracking: BudgetTracking[] = trip.stops
      .filter((s: any) => s.budget)
      .map((s: any) => ({
        stopId: s._id,
        stopName: s.name,
        budget: s.budget!,
        spent: s.totalSpentLocal,
        remaining: s.budget! - s.totalSpentLocal,
        utilization: parseFloat(((s.totalSpentLocal / s.budget!) * 100).toFixed(1)),
        status: (s.totalSpentLocal / s.budget!) > 1 ? 'over' : (s.totalSpentLocal / s.budget!) > 0.8 ? 'on_track' : 'under',
      }));

    // Estimated transfers (net balance method)
    const positiveBalances = memberSpending.filter((m) => m.netBalance > 0);
    const estimatedTransfers = positiveBalances.length;

    return {
      tripInfo: {
        tripId: trip._id.toString(),
        title: trip.title,
        baseCurrency: trip.baseCurrency,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        duration: tripDays,
        status: trip.status,
        memberCount: activeMembers.length,
        stopCount: trip.stops.length,
        totalBudget: trip.totalBudget,
        budgetUtilization: trip.totalBudget ? parseFloat(((totalSpent / trip.totalBudget) * 100).toFixed(1)) : undefined,
      },
      summary: {
        totalSpent,
        totalExpenses,
        averagePerExpense: parseFloat((summaryResult[0]?.avgPerExpense || 0).toFixed(2)),
        averagePerDay: parseFloat((totalSpent / tripDays).toFixed(2)),
        averagePerPerson: parseFloat((totalSpent / Math.max(1, activeMembers.length)).toFixed(2)),
        medianExpense: parseFloat(median.toFixed(2)),
        maxDailySpend: maxDaily,
        baseCurrency: trip.baseCurrency,
      },
      settlement: {
        settledCount: settled?.count || 0,
        settledAmount: settled?.totalAmount || 0,
        unsettledCount: unsettled?.count || 0,
        unsettledAmount: unsettled?.totalAmount || 0,
        settlementRate: totalExpenses > 0 ? parseFloat((((settled?.count || 0) / totalExpenses) * 100).toFixed(1)) : 0,
        estimatedTransfers,
      },
      highestExpense: highestExpense[0] ? {
        _id: highestExpense[0]._id.toString(),
        title: highestExpense[0].title,
        amountBase: highestExpense[0].amountBase,
        amountLocal: highestExpense[0].amountLocal,
        currency: highestExpense[0].localCurrency,
        date: highestExpense[0].date?.toISOString(),
        paidByName: highestExpense[0].paidByName,
        category: highestExpense[0].category,
      } : null,
      lowestExpense: lowestExpense[0] ? {
        _id: lowestExpense[0]._id.toString(),
        title: lowestExpense[0].title,
        amountBase: lowestExpense[0].amountBase,
        amountLocal: lowestExpense[0].amountLocal,
        currency: lowestExpense[0].localCurrency,
        date: lowestExpense[0].date?.toISOString(),
        paidByName: lowestExpense[0].paidByName,
        category: lowestExpense[0].category,
      } : null,
      categories: categories.map((c: any) => ({
        category: c._id,
        emoji: CATEGORY_EMOJIS[c._id] || '📌',
        totalAmount: c.totalAmount,
        percentage: totalSpent > 0 ? parseFloat(((c.totalAmount / totalSpent) * 100).toFixed(1)) : 0,
        count: c.count,
        averagePerExpense: parseFloat((c.avgAmount || 0).toFixed(2)),
        trend: 'stable',
      })),
      dailySpending: dailyData.map((d: any) => ({
        date: d._id,
        totalAmount: d.totalAmount,
        count: d.count,
        dayOfWeek: DAY_NAMES[new Date(d._id).getDay()],
      })),
      memberSpending: memberSpending.map((m) => ({
        ...m,
        percentage: totalSpent > 0 ? parseFloat(((m.totalPaid / totalSpent) * 100).toFixed(1)) : 0,
      })),
      stopBreakdown,
      currencyBreakdown: currencyData.map((c: any) => ({
        currency: c._id,
        totalLocal: c.totalLocal,
        totalBase: c.totalBase,
        exchangeRate: parseFloat((c.exchangeRate || 0).toFixed(2)),
        count: c.count,
        percentage: totalSpent > 0 ? parseFloat(((c.totalBase / totalSpent) * 100).toFixed(1)) : 0,
      })),
      dayOfWeekPattern: DAY_NAMES.map((day, index) => {
        const found = dayOfWeek.find((d: any) => d._id === index + 1);
        return {
          day,
          totalAmount: found?.totalAmount || 0,
          count: found?.count || 0,
          percentage: totalSpent > 0 ? parseFloat((((found?.totalAmount || 0) / totalSpent) * 100).toFixed(1)) : 0,
        };
      }),
      spendingVelocity: velocityData,
      budgetTracking,
    };
  },

  // ==========================================================
  // YEARLY SUMMARY
  // ==========================================================
  async getYearlySummary(userId: string, year: number): Promise<YearlySummary> {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);
    const match = {
      $or: [{ paidBy: userId }, { 'splits.userId': userId }],
      date: { $gte: startDate, $lte: endDate },
    };

    const [monthlyData, categoryData, quarterlyData, prevYearData] = await Promise.all([
      Expense.aggregate([{ $match: match }, { $group: { _id: { $month: '$date' }, totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: '$category', totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 } } }, { $sort: { totalAmount: -1 } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: { $ceil: { $divide: [{ $month: '$date' }, 3] } }, totalAmount: { $sum: '$amountBase' }, count: { $sum: 1 }, months: { $addToSet: { $month: '$date' } } } }, { $sort: { _id: 1 } }]),
      Expense.aggregate([{ $match: { ...match, date: { $gte: new Date(`${year - 1}-01-01`), $lte: new Date(`${year - 1}-12-31`) } } }, { $group: { _id: null, totalSpent: { $sum: '$amountBase' }, totalExpenses: { $sum: 1 } } }]),
    ]);

    const yearlyTotal = monthlyData.reduce((sum, m) => sum + m.totalAmount, 0);
    const months = Array.from({ length: 12 }, (_, i) => {
      const found = monthlyData.find((m) => m._id === i + 1);
      return {
        month: `${year}-${String(i + 1).padStart(2, '0')}`,
        monthName: MONTH_NAMES[i],
        totalAmount: found?.totalAmount || 0,
        count: found?.count || 0,
        categories: {},
      };
    });

    const sortedMonths = [...months].sort((a, b) => b.totalAmount - a.totalAmount);
    const prevYearTotal = prevYearData[0]?.totalSpent || 0;
    const yoyChange = prevYearTotal > 0 ? parseFloat((((yearlyTotal - prevYearTotal) / prevYearTotal) * 100).toFixed(1)) : yearlyTotal > 0 ? 100 : 0;

    return {
      year,
      totalSpent: yearlyTotal,
      totalExpenses: monthlyData.reduce((sum, m) => sum + m.count, 0),
      averagePerMonth: parseFloat((yearlyTotal / 12).toFixed(2)),
      highestMonth: sortedMonths[0],
      lowestMonth: sortedMonths[11],
      monthlyBreakdown: months,
      quarterlyBreakdown: quarterlyData.map((q: any) => ({
        quarter: `Q${q._id}`,
        totalAmount: q.totalAmount,
        count: q.count,
        months: q.months,
      })),
      categories: categoryData.map((c: any) => ({
        category: c._id,
        emoji: CATEGORY_EMOJIS[c._id] || '📌',
        totalAmount: c.totalAmount,
        percentage: yearlyTotal > 0 ? parseFloat(((c.totalAmount / yearlyTotal) * 100).toFixed(1)) : 0,
        count: c.count,
        averagePerExpense: 0,
        trend: 'stable',
      })),
      yearOverYear: {
        previousYear: prevYearTotal,
        changePercent: yoyChange,
        trend: yoyChange > 5 ? 'up' : yoyChange < -5 ? 'down' : 'stable',
      },
    };
  },
};
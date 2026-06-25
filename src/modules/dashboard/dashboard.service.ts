import { Types } from 'mongoose';
import { Expense } from '../expense/expense.model';
import { Trip } from '../trips/trip.model';
import { Settlement } from '../settlement/settlement.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';

// ============================================================
// Dashboard Service — Complete financial overview
// ============================================================

export const dashboardService = {
    /**
     * Get complete dashboard data for a user.
     * Single API call that returns everything the dashboard needs.
     */
    async getDashboard(userId: string, type?: string) {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        let userFilter: any = {
            $or: [{ paidBy: userId }, { 'splits.userId': userId }],
        };

        if (type) {
            if (type === 'you_owe') {
                userFilter = {
                    paidBy: { $ne: userId },
                    splits: { $elemMatch: { userId: userId, isPaid: false } },
                };
            } else if (type === 'you_paid') {
                userFilter = { paidBy: userId };
            } else if (type === 'unsettled') {
                userFilter.isSettled = false;
                userFilter.$or = [{ paidBy: userId }, { 'splits.userId': userId }];
            } else if (type === 'settled') {
                userFilter.isSettled = true;
                userFilter.$or = [{ paidBy: userId }, { 'splits.userId': userId }];
            } else if (type === 'archived') {
                userFilter.isArchived = true;
                userFilter.$or = [{ paidBy: userId }, { 'splits.userId': userId }];
            }
        }

        // Run ALL queries in parallel for speed
        const [
            thisMonthStats,
            lastMonthStats,
            categoryBreakdown,
            monthlyTrend,
            allExpenses,
            youOweExpenses,
            youAreOwedExpenses,
            activeTrips,
            pendingSettlements,
            userBalances,
            recentExpenses,
        ] = await Promise.all([
            // This month summary
            Expense.aggregate([
                { $match: { $and: [userFilter, { date: { $gte: thisMonthStart } }] } },
                { $group: { _id: null, total: { $sum: '$amountBase' }, count: { $sum: 1 }, avg: { $avg: '$amountBase' } } },
            ]),
            // Last month summary
            Expense.aggregate([
                { $match: { $and: [userFilter, { date: { $gte: lastMonthStart, $lt: thisMonthStart } }] } },
                { $group: { _id: null, total: { $sum: '$amountBase' }, count: { $sum: 1 } } },
            ]),
            // Category breakdown
            Expense.aggregate([
                { $match: { $and: [userFilter, { date: { $gte: thisMonthStart } }] } },
                { $group: { _id: '$category', total: { $sum: '$amountBase' }, count: { $sum: 1 } } },
                { $sort: { total: -1 } },
            ]),
            // Monthly trend (6 months)
            Expense.aggregate([
                { $match: { $and: [userFilter, { date: { $gte: sixMonthsAgo } }] } },
                { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, total: { $sum: '$amountBase' }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
            ]),
            // All expenses (for person grouping)
            Expense.find(userFilter).select('title amountBase amountLocal localCurrency baseCurrency date category paidBy paidByName splits.isPaid splits.userId splits.displayName splits.amountBase tripId').lean(),
            // Expenses where USER owes money: someone else paid, and user's own split is still unpaid
            Expense.find({
                $and: [
                    userFilter,
                    {
                        paidBy: { $ne: userId },
                        splits: { $elemMatch: { userId: userId, isPaid: false } },
                    }
                ]
            }).select('title amountBase amountLocal localCurrency date category paidBy paidByName splits tripId')
              .populate('tripId', 'title')
              .lean(),
            // Expenses where user IS OWED money: user paid, and at least one other person's split is unpaid
            Expense.find({
                $and: [
                    userFilter,
                    {
                        paidBy: userId,
                        splits: { $elemMatch: { userId: { $ne: userId }, isPaid: false } },
                    }
                ]
            }).select('title amountBase amountLocal localCurrency date category paidBy paidByName splits tripId')
              .populate('tripId', 'title')
              .lean(),
            // Active trips
            Trip.countDocuments({ 'members.userId': userId, 'members.isActive': true, status: { $in: ['active', 'planning'] }, isArchived: false }),
            // Pending settlements
            Expense.countDocuments({ $and: [userFilter, { isSettled: false }] }),
            // User balances
            User.findById(userId).select('totalLentAcrossTrips totalOwedAcrossTrips displayName photoURL').lean(),
            // Recent expenses (last 5)
            Expense.find(userFilter).sort({ date: -1 }).limit(10)
                .select('title amountBase amountLocal localCurrency date category paidBy paidByName tripId')
                .populate('tripId', 'title').lean(),
        ]);

        const thisMonthTotal = thisMonthStats[0]?.total || 0;
        const lastMonthTotal = lastMonthStats[0]?.total || 0;
        const spendingChange = lastMonthTotal > 0
            ? parseFloat((((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1))
            : thisMonthTotal > 0 ? 100 : 0;

        // Group expenses by person (who you owe)
        const oweMap: Record<string, { userId: string; name: string; amount: number; expenses: any[] }> = {};
        let dynamicTotalOwed = 0;
        youOweExpenses.forEach((exp: any) => {
            const mySplit = exp.splits?.find((s: any) => s.userId === userId);
            if (mySplit && !mySplit.isPaid) {
                if (!oweMap[exp.paidBy]) {
                    oweMap[exp.paidBy] = { userId: exp.paidBy, name: exp.paidByName, amount: 0, expenses: [] };
                }
                oweMap[exp.paidBy].amount += mySplit.amountBase;
                dynamicTotalOwed += mySplit.amountBase;
                oweMap[exp.paidBy].expenses.push({
                    expenseId: exp._id,
                    title: exp.title,
                    amount: mySplit.amountBase,
                    category: exp.category,
                    date: exp.date,
                    tripId: exp.tripId?._id || exp.tripId,
                    tripTitle: exp.tripId?.title || 'Unknown Trip',
                });
            }
        });

        // Group expenses by person (who owes you)
        const owedMap: Record<string, { userId: string; name: string; amount: number; expenses: any[] }> = {};
        let dynamicTotalLent = 0;
        youAreOwedExpenses.forEach((exp: any) => {
            exp.splits?.forEach((s: any) => {
                if (!s.isPaid && s.userId !== userId) {
                    if (!owedMap[s.userId]) {
                        owedMap[s.userId] = { userId: s.userId, name: s.displayName, amount: 0, expenses: [] };
                    }
                    owedMap[s.userId].amount += s.amountBase;
                    dynamicTotalLent += s.amountBase;
                    owedMap[s.userId].expenses.push({
                        expenseId: exp._id,
                        title: exp.title,
                        amount: s.amountBase,
                        category: exp.category,
                        date: exp.date,
                        tripId: exp.tripId?._id || exp.tripId,
                        tripTitle: exp.tripId?.title || 'Unknown Trip',
                    });
                }
            });
        });

        return {
            summary: {
                thisMonth: {
                    total: thisMonthTotal,
                    count: thisMonthStats[0]?.count || 0,
                    averagePerExpense: parseFloat((thisMonthStats[0]?.avg || 0).toFixed(2)),
                },
                lastMonth: {
                    total: lastMonthTotal,
                    count: lastMonthStats[0]?.count || 0,
                },
                spendingChange,
                activeTrips,
                pendingSettlements,
            },
            balances: {
                totalLent: dynamicTotalLent,
                totalOwed: dynamicTotalOwed,
                netBalance: dynamicTotalLent - dynamicTotalOwed,
            },
            categories: categoryBreakdown.map((c: any) => ({
                category: c._id,
                totalAmount: c.total,
                percentage: thisMonthTotal > 0 ? parseFloat(((c.total / thisMonthTotal) * 100).toFixed(1)) : 0,
                count: c.count,
            })),
            monthlyTrend: monthlyTrend.map((m: any) => ({
                month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
                monthName: new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short' }),
                total: m.total,
                count: m.count,
            })),
            youOwe: Object.values(oweMap)
                .sort((a, b) => b.amount - a.amount)
                .map((p) => ({
                    userId: p.userId,
                    name: p.name,
                    totalAmount: parseFloat(p.amount.toFixed(2)),
                    expenseCount: p.expenses.length,
                    expenses: p.expenses.slice(0, 5), // First 5 expenses
                })),
            youAreOwed: Object.values(owedMap)
                .sort((a, b) => b.amount - a.amount)
                .map((p) => ({
                    userId: p.userId,
                    name: p.name,
                    totalAmount: parseFloat(p.amount.toFixed(2)),
                    expenseCount: p.expenses.length,
                    expenses: p.expenses.slice(0, 5),
                })),
            recentExpenses: recentExpenses.map((e: any) => ({
                _id: e._id,
                title: e.title,
                amountBase: e.amountBase,
                amountLocal: e.amountLocal,
                localCurrency: e.localCurrency,
                baseCurrency: e.baseCurrency,
                date: e.date,
                category: e.category,
                paidByName: e.paidByName,
                tripTitle: e.tripId?.title || 'Unknown Trip',
                tripId: e.tripId?._id,
            })),
        };
    },
};
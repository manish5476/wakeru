import { Types } from 'mongoose';
import { Expense } from '../expense/expense.model';
import { Trip } from '../trips/trip.model';
import { Settlement } from '../settlement/settlement.model';
import { Friendship, FriendRequest } from '../friends/friends.model';
import { Invitation } from '../trips/invitation.model';
import { JoinRequest } from '../trips/join_request.model';
import { User } from '../auth/auth.model';
import { UserAchievement } from '../achievement/achievement.model';
import { Bill, Goal } from '../finance/finance.model';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';

// ============================================================
// Dashboard Service — Complete Home Screen
// ============================================================

export const dashboardService = {

    async getDashboard(userId: string, type?: string) {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000);

        // Build filter based on type
        let userFilter: any = {
            isArchived: false,
            $or: [{ paidBy: userId }, { 'splits.userId': userId }],
        };

        if (type === 'you_owe') {
            userFilter = {
                isArchived: false,
                paidBy: { $ne: userId },
                splits: { $elemMatch: { userId, isPaid: false } },
            };
        } else if (type === 'you_paid') {
            userFilter = {
                isArchived: false,
                paidBy: userId,
            };
        } else if (type === 'unsettled') {
            userFilter = {
                isArchived: false,
                isSettled: false,
                $or: [{ paidBy: userId }, { 'splits.userId': userId }],
            };
        } else if (type === 'settled') {
            userFilter = {
                isArchived: false,
                isSettled: true,
                $or: [{ paidBy: userId }, { 'splits.userId': userId }],
            };
        }

        // ── RUN ALL QUERIES IN PARALLEL ──────────────────
        const [
            thisMonthStats,
            lastMonthStats,
            categoryBreakdown,
            monthlyTrend,
            youOweExpenses,
            youAreOwedExpenses,
            activeTrips,
            upcomingTrips,
            completedTrips,
            pendingSettlements,
            recentExpenses,
            pendingFriendRequests,
            pendingTripInvites,
            pendingJoinRequests,
            upcomingBills,
            activeGoals,
            recentAchievements,
            totalTripsCount,
            allTripsForStats,
        ] = await Promise.all([
            // This month summary
            Expense.aggregate([
                { $match: { ...userFilter, date: { $gte: thisMonthStart } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amountBase' },
                        count: { $sum: 1 },
                        avg: { $avg: '$amountBase' },
                    },
                },
            ]),
            // Last month summary
            Expense.aggregate([
                { $match: { ...userFilter, date: { $gte: lastMonthStart, $lt: thisMonthStart } } },
                { $group: { _id: null, total: { $sum: '$amountBase' }, count: { $sum: 1 } } },
            ]),
            // Category breakdown (this month)
            Expense.aggregate([
                { $match: { ...userFilter, date: { $gte: thisMonthStart } } },
                { $group: { _id: '$category', total: { $sum: '$amountBase' }, count: { $sum: 1 } } },
                { $sort: { total: -1 } },
            ]),
            // Monthly trend (6 months)
            Expense.aggregate([
                { $match: { ...userFilter, date: { $gte: sixMonthsAgo } } },
                {
                    $group: {
                        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
                        total: { $sum: '$amountBase' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
            ]),
            // You owe expenses
            Expense.find({
                isArchived: false,
                paidBy: { $ne: userId },
                splits: { $elemMatch: { userId, isPaid: false } },
            })
                .select('title amountBase localCurrency date category paidBy paidByName splits tripId')
                .populate('tripId', 'title')
                .lean(),
            // You are owed expenses
            Expense.find({
                isArchived: false,
                paidBy: userId,
                splits: { $elemMatch: { userId: { $ne: userId }, isPaid: false } },
            })
                .select('title amountBase localCurrency date category paidBy paidByName splits tripId')
                .populate('tripId', 'title')
                .lean(),
            // Active trips (planning + active)
            Trip.find({
                'members.userId': userId,
                'members.isActive': true,
                status: { $in: ['active', 'planning'] },
                isArchived: false,
            })
                .select('title coverImage startDate endDate status members totalSpentBase')
                .sort({ startDate: 1 })
                .limit(5)
                .lean(),
            // Upcoming trips (starts within 30 days)
            Trip.find({
                'members.userId': userId,
                'members.isActive': true,
                status: 'planning',
                startDate: { $gte: now, $lte: new Date(now.getTime() + 30 * 86400000) },
                isArchived: false,
            })
                .select('title coverImage startDate endDate')
                .sort({ startDate: 1 })
                .limit(3)
                .lean(),
            // Recently completed trips
            Trip.find({
                'members.userId': userId,
                'members.isActive': true,
                status: 'completed',
                isArchived: false,
            })
                .select('title coverImage endDate totalSpentBase')
                .sort({ endDate: -1 })
                .limit(3)
                .lean(),
            // Pending settlements count
            Expense.countDocuments({
                isArchived: false,
                isSettled: false,
                $or: [{ paidBy: userId }, { 'splits.userId': userId }],
            }),
            // Recent expenses (last 10)
            Expense.find(userFilter)
                .sort({ date: -1 })
                .limit(10)
                .select('title amountBase amountLocal localCurrency baseCurrency date category paidBy paidByName tripId isSettled')
                .populate('tripId', 'title')
                .lean(),
            // Pending friend requests
            FriendRequest.countDocuments({ toUserId: userId, status: 'pending' }),
            // Pending trip invites
            Invitation.countDocuments({ toUserId: userId, status: 'pending' }),
            // Pending join requests (trips where user is admin)
            JoinRequest.countDocuments({
                tripId: {
                    $in: (await Trip.find({
                        'members.userId': userId,
                        'members.role': 'admin',
                        'members.isActive': true,
                        isArchived: false,
                    }).select('_id')).map(t => t._id),
                },
                status: 'pending',
            }),
            // Upcoming bills (due within 7 days)
            Bill.find({
                userId,
                isActive: true,
                paidThisMonth: false,
                dueDate: { $lte: new Date(now.getTime() + 7 * 86400000) },
            })
                .sort({ dueDate: 1 })
                .limit(5)
                .lean(),
            // Active goals
            Goal.find({ userId, isCompleted: false })
                .sort({ targetDate: 1 })
                .limit(3)
                .lean(),
            // Recent achievements
            UserAchievement.find({ userId, isUnlocked: true })
                .sort({ unlockedAt: -1 })
                .limit(3)
                .lean(),
            // Total trips count
            Trip.countDocuments({
                'members.userId': userId,
                'members.isActive': true,
                isArchived: false,
            }),
            // All trips for stats
            Trip.find({
                'members.userId': userId,
                'members.isActive': true,
                isArchived: false,
            })
                .select('title startDate endDate totalSpentBase members stops')
                .lean(),
        ]);

        // ── CALCULATIONS ────────────────────────────────

        const thisMonthTotal = thisMonthStats[0]?.total || 0;
        const thisMonthCount = thisMonthStats[0]?.count || 0;
        const lastMonthTotal = lastMonthStats[0]?.total || 0;
        const spendingChange = lastMonthTotal > 0
            ? parseFloat((((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1))
            : thisMonthTotal > 0 ? 100 : 0;

        // You Owe grouping
        const oweMap: Record<string, any> = {};
        let totalOwed = 0;
        youOweExpenses.forEach((exp: any) => {
            const mySplit = exp.splits?.find((s: any) => s.userId === userId);
            if (mySplit && !mySplit.isPaid) {
                const amount = mySplit.amountBase || 0;
                if (!oweMap[exp.paidBy]) {
                    oweMap[exp.paidBy] = { userId: exp.paidBy, name: exp.paidByName, amount: 0, expenses: [] };
                }
                oweMap[exp.paidBy].amount += amount;
                totalOwed += amount;
                if (oweMap[exp.paidBy].expenses.length < 5) {
                    oweMap[exp.paidBy].expenses.push({
                        expenseId: exp._id,
                        title: exp.title,
                        amount,
                        category: exp.category,
                        date: exp.date,
                        tripId: exp.tripId?._id || exp.tripId,
                        tripTitle: exp.tripId?.title || 'Unknown Trip',
                    });
                }
            }
        });

        // You Are Owed grouping
        const owedMap: Record<string, any> = {};
        let totalLent = 0;
        youAreOwedExpenses.forEach((exp: any) => {
            exp.splits?.forEach((s: any) => {
                if (!s.isPaid && s.userId !== userId) {
                    const amount = s.amountBase || 0;
                    if (!owedMap[s.userId]) {
                        owedMap[s.userId] = { userId: s.userId, name: s.displayName, amount: 0, expenses: [] };
                    }
                    owedMap[s.userId].amount += amount;
                    totalLent += amount;
                    if (owedMap[s.userId].expenses.length < 5) {
                        owedMap[s.userId].expenses.push({
                            expenseId: exp._id,
                            title: exp.title,
                            amount,
                            category: exp.category,
                            date: exp.date,
                            tripId: exp.tripId?._id || exp.tripId,
                            tripTitle: exp.tripId?.title || 'Unknown Trip',
                        });
                    }
                }
            });
        });

        // Pending actions
        const pendingActions = this._buildPendingActions(
            totalOwed,
            pendingSettlements,
            pendingFriendRequests,
            pendingTripInvites,
            pendingJoinRequests,
            upcomingBills,
            activeTrips,
            thisMonthTotal,
            activeGoals
        );

        // Quick stats
        const quickStats = this._buildQuickStats(
            allTripsForStats,
            totalTripsCount,
            recentAchievements
        );

        return {
            // ── MONTHLY OVERVIEW ──────────────────────
            summary: {
                thisMonth: {
                    total: Math.round(thisMonthTotal * 100) / 100,
                    count: thisMonthCount,
                    averagePerExpense: thisMonthCount > 0
                        ? Math.round((thisMonthTotal / thisMonthCount) * 100) / 100
                        : 0,
                },
                lastMonth: {
                    total: Math.round(lastMonthTotal * 100) / 100,
                    count: lastMonthStats[0]?.count || 0,
                },
                spendingChange, // Negative = spending less this month
                activeTrips: activeTrips.length,
                pendingSettlements,
            },

            // ── BALANCES ──────────────────────────────
            balances: {
                totalLent: Math.round(totalLent * 100) / 100,
                totalOwed: Math.round(totalOwed * 100) / 100,
                netBalance: Math.round((totalLent - totalOwed) * 100) / 100,
                baseCurrency: activeTrips[0]?.baseCurrency || 'INR',
            },

            // ── CATEGORY BREAKDOWN ────────────────────
            categories: categoryBreakdown.map((c: any) => ({
                category: c._id,
                totalAmount: Math.round(c.total * 100) / 100,
                percentage: thisMonthTotal > 0
                    ? parseFloat(((c.total / thisMonthTotal) * 100).toFixed(1))
                    : 0,
                count: c.count,
            })),

            // ── MONTHLY TREND ─────────────────────────
            monthlyTrend: monthlyTrend.map((m: any) => ({
                month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
                monthName: new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short' }),
                total: Math.round(m.total * 100) / 100,
                count: m.count,
            })),

            // ── YOU OWE ───────────────────────────────
            youOwe: Object.values(oweMap)
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((p: any) => ({
                    userId: p.userId,
                    name: p.name,
                    totalAmount: Math.round(p.amount * 100) / 100,
                    expenseCount: youOweExpenses.filter(
                        (e: any) => e.paidBy === p.userId
                    ).length,
                    expenses: p.expenses,
                })),

            // ── YOU ARE OWED ──────────────────────────
            youAreOwed: Object.values(owedMap)
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((p: any) => ({
                    userId: p.userId,
                    name: p.name,
                    totalAmount: Math.round(p.amount * 100) / 100,
                    expenseCount: youAreOwedExpenses.filter(
                        (e: any) => e.splits?.some((s: any) => s.userId === p.userId && !s.isPaid)
                    ).length,
                    expenses: p.expenses,
                })),

            // ── ACTIVE TRIPS ──────────────────────────
            activeTrips: activeTrips.map((trip: any) => ({
                tripId: trip._id.toString(),
                title: trip.title,
                coverImage: trip.coverImage,
                startDate: trip.startDate,
                endDate: trip.endDate,
                status: trip.status,
                daysLeft: Math.max(0, Math.ceil((new Date(trip.endDate).getTime() - Date.now()) / 86400000)),
                totalSpent: trip.totalSpentBase || 0,
                memberCount: trip.members?.filter((m: any) => m.isActive).length || 0,
                memberPreviews: (trip.members || [])
                    .filter((m: any) => m.isActive)
                    .slice(0, 4)
                    .map((m: any) => ({
                        userId: m.userId,
                        displayName: m.displayName,
                        photoURL: m.photoURL || '',
                    })),
            })),

            // ── UPCOMING TRIPS ────────────────────────
            upcomingTrips: upcomingTrips.map((trip: any) => ({
                tripId: trip._id.toString(),
                title: trip.title,
                coverImage: trip.coverImage,
                startDate: trip.startDate,
                endDate: trip.endDate,
                daysUntilStart: Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000),
            })),

            // ── RECENTLY COMPLETED ────────────────────
            recentlyCompleted: completedTrips.map((trip: any) => ({
                tripId: trip._id.toString(),
                title: trip.title,
                coverImage: trip.coverImage,
                endDate: trip.endDate,
                totalSpent: trip.totalSpentBase || 0,
            })),

            // ── RECENT EXPENSES ───────────────────────
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
                isSettled: e.isSettled,
                tripTitle: e.tripId?.title || 'Unknown Trip',
                tripId: e.tripId?._id,
                direction: e.paidBy === userId ? 'you_paid' : 'they_paid',
            })),

            // ── PENDING ACTIONS (NEW) ─────────────────
            pendingActions,

            // ── QUICK STATS (NEW) ─────────────────────
            quickStats,

            // ── UPCOMING BILLS (NEW) ──────────────────
            upcomingBills: upcomingBills.map((b: any) => ({
                billId: b._id.toString(),
                title: b.title,
                amount: b.amount,
                currency: b.currency,
                dueDate: b.dueDate,
                daysUntilDue: Math.ceil((new Date(b.dueDate).getTime() - Date.now()) / 86400000),
                category: b.category,
                isRecurring: b.frequency !== 'once',
            })),

            // ── ACTIVE GOALS (NEW) ────────────────────
            activeGoals: activeGoals.map((g: any) => ({
                goalId: g._id.toString(),
                title: g.title,
                icon: g.icon || '🎯',
                targetAmount: g.targetAmount,
                savedAmount: g.savedAmount,
                progress: g.progress,
                currency: g.currency,
                targetDate: g.targetDate,
                daysLeft: Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / 86400000),
            })),

            // ── RECENT ACHIEVEMENTS (NEW) ─────────────
            recentAchievements: recentAchievements.map((a: any) => ({
                achievementId: a.achievementId,
                name: a.name,
                description: a.description,
                icon: a.icon,
                tier: a.tier,
                unlockedAt: a.unlockedAt,
            })),
        };
    },

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    _buildPendingActions(
        totalOwed: number,
        pendingSettlements: number,
        pendingFriendRequests: number,
        pendingTripInvites: number,
        pendingJoinRequests: number,
        upcomingBills: any[],
        activeTrips: any[],
        thisMonthTotal: number,
        activeGoals: any[]
    ) {
        const actions: any[] = [];

        if (totalOwed > 0) {
            actions.push({
                type: 'you_owe',
                title: 'You Owe Money',
                message: `You owe ₹${totalOwed.toFixed(0)} across your trips`,
                priority: 'high',
                count: 1,
                actionType: 'view_you_owe',
                actionData: {},
                icon: '💸',
            });
        }

        if (pendingSettlements > 0) {
            actions.push({
                type: 'pending_settlements',
                title: 'Pending Settlements',
                message: `${pendingSettlements} expenses need settling`,
                priority: pendingSettlements > 5 ? 'urgent' : 'high',
                count: pendingSettlements,
                actionType: 'view_settlements',
                actionData: {},
                icon: '⚠️',
            });
        }

        if (pendingFriendRequests > 0) {
            actions.push({
                type: 'friend_requests',
                title: 'Friend Requests',
                message: `${pendingFriendRequests} pending friend request(s)`,
                priority: 'medium',
                count: pendingFriendRequests,
                actionType: 'view_friend_requests',
                actionData: {},
                icon: '🤝',
            });
        }

        if (pendingTripInvites + pendingJoinRequests > 0) {
            actions.push({
                type: 'trip_invites',
                title: 'Trip Invitations',
                message: `${pendingTripInvites + pendingJoinRequests} pending trip invite(s)`,
                priority: 'medium',
                count: pendingTripInvites + pendingJoinRequests,
                actionType: 'view_invitations',
                actionData: {},
                icon: '🧳',
            });
        }

        const dueBills = upcomingBills.filter((b: any) => {
            const daysUntil = Math.ceil((new Date(b.dueDate).getTime() - Date.now()) / 86400000);
            return daysUntil <= 3;
        });

        if (dueBills.length > 0) {
            actions.push({
                type: 'bills_due',
                title: 'Bills Due Soon',
                message: `${dueBills.length} bill(s) due within 3 days`,
                priority: 'high',
                count: dueBills.length,
                actionType: 'view_bills',
                actionData: {},
                icon: '📋',
            });
        }

        const endingTrips = activeTrips.filter((t: any) => {
            const daysLeft = Math.ceil((new Date(t.endDate).getTime() - Date.now()) / 86400000);
            return daysLeft <= 3 && daysLeft >= 0;
        });

        if (endingTrips.length > 0) {
            actions.push({
                type: 'trip_ending',
                title: 'Trip Ending Soon',
                message: `${endingTrips.length} trip(s) ending — time to settle up!`,
                priority: 'high',
                count: endingTrips.length,
                actionType: 'view_trips',
                actionData: {},
                icon: '🏁',
            });
        }

        if (activeGoals.length > 0) {
            const nearGoal = activeGoals.filter((g: any) => g.progress >= 80);
            if (nearGoal.length > 0) {
                actions.push({
                    type: 'goal_near',
                    title: 'Goal Almost Complete!',
                    message: `${nearGoal.length} goal(s) almost reached`,
                    priority: 'medium',
                    count: nearGoal.length,
                    actionType: 'view_goals',
                    actionData: {},
                    icon: '🎯',
                });
            }
        }

        return actions.sort((a, b) => {
            const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
            return order[a.priority] - order[b.priority];
        });
    },

    _buildQuickStats(
        allTrips: any[],
        totalTripsCount: number,
        recentAchievements: any[]
    ) {
        // Total countries
        const countries = new Set<string>();
        allTrips.forEach(t => {
            t.stops?.forEach((s: any) => {
                if (s.country) countries.add(s.country);
            });
        });

        // Longest trip
        const longestTrip = allTrips.reduce((longest: any, t: any) => {
            const days = Math.ceil((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 86400000);
            const longestDays = longest
                ? Math.ceil((new Date(longest.endDate).getTime() - new Date(longest.startDate).getTime()) / 86400000)
                : 0;
            return days > longestDays ? t : longest;
        }, null);

        // Most expensive trip
        const mostExpensiveTrip = allTrips.reduce((max: any, t: any) => {
            return (t.totalSpentBase || 0) > (max?.totalSpentBase || 0) ? t : max;
        }, null);

        // Favorite travel buddy
        const buddyCount: Record<string, any> = {};
        allTrips.forEach(t => {
            t.members?.forEach((m: any) => {
                if (m.isActive) {
                    if (!buddyCount[m.userId]) {
                        buddyCount[m.userId] = { displayName: m.displayName, photoURL: m.photoURL || '', count: 0 };
                    }
                    buddyCount[m.userId].count++;
                }
            });
        });

        // Remove self
        const favoriteBuddy = Object.entries(buddyCount)
            .sort(([, a], [, b]) => b.count - a.count)[0];

        return {
            totalTrips: totalTripsCount,
            totalCountries: countries.size || 0,
            longestTrip: longestTrip
                ? {
                    title: longestTrip.title,
                    days: Math.ceil((new Date(longestTrip.endDate).getTime() - new Date(longestTrip.startDate).getTime()) / 86400000),
                }
                : null,
            mostExpensiveTrip: mostExpensiveTrip
                ? { title: mostExpensiveTrip.title, amount: mostExpensiveTrip.totalSpentBase || 0 }
                : null,
            favoriteBuddy: favoriteBuddy
                ? { userId: favoriteBuddy[0], displayName: favoriteBuddy[1].displayName, photoURL: favoriteBuddy[1].photoURL, sharedTrips: favoriteBuddy[1].count }
                : null,
            recentAchievements: recentAchievements.map((a: any) => ({
                name: a.name,
                icon: a.icon,
                tier: a.tier,
            })),
        };
    },
};
import { Expense } from '../expense/expense.model';
import { Trip } from '../trips/trip.model';
import { Types } from 'mongoose';

export const comparisonService = {
    /**
     * Compare current trip with previous trips.
     */
    async compareTripWithPrevious(tripId: string, userId: string) {
        const currentTrip = await Trip.findById(tripId);
        if (!currentTrip) throw new Error('Trip not found');

        const currentExpenses = await Expense.find({ tripId: new Types.ObjectId(tripId) });
        const currentTotal = currentExpenses.reduce((s, e) => s + e.amountBase, 0);
        const currentDays = Math.ceil((currentTrip.endDate.getTime() - currentTrip.startDate.getTime()) / 86400000);

        // Find previous trips by this user
        const previousTrips = await Trip.find({
            'members.userId': userId,
            _id: { $ne: new Types.ObjectId(tripId) },
            endDate: { $lt: currentTrip.startDate },
            isArchived: false,
        })
            .sort({ endDate: -1 })
            .limit(3)
            .lean();

        const comparisons = await Promise.all(
            previousTrips.map(async (prevTrip) => {
                const prevExpenses = await Expense.find({ tripId: prevTrip._id });
                const prevTotal = prevExpenses.reduce((s, e) => s + e.amountBase, 0);
                const prevDays = Math.ceil((prevTrip.endDate.getTime() - prevTrip.startDate.getTime()) / 86400000);
                const prevPerDay = prevTotal / Math.max(1, prevDays);
                const currentPerDay = currentTotal / Math.max(1, currentDays);

                // Category comparison
                const prevCategories = this.groupByCategory(prevExpenses);
                const currentCategories = this.groupByCategory(currentExpenses);

                return {
                    tripId: prevTrip._id,
                    title: prevTrip.title,
                    totalSpent: prevTotal,
                    perDay: prevPerDay,
                    days: prevDays,
                    memberCount: prevTrip.members.filter((m: any) => m.isActive).length,
                    savings: prevPerDay - currentPerDay, // positive = saving vs previous
                    categories: Object.keys(currentCategories).map((cat) => ({
                        category: cat,
                        current: currentCategories[cat] || 0,
                        previous: prevCategories[cat] || 0,
                        change: (currentCategories[cat] || 0) - (prevCategories[cat] || 0),
                    })),
                };
            })
        );

        return {
            currentTrip: {
                title: currentTrip.title,
                totalSpent: currentTotal,
                perDay: currentTotal / Math.max(1, currentDays),
                days: currentDays,
                members: currentTrip.members.filter((m: any) => m.isActive).length,
            },
            comparisons,
            insights: this.generateInsights(comparisons, currentTotal, currentDays),
        };
    },

    /**
     * Compare user's spending with group average.
     */
    async compareWithGroup(tripId: string, userId: string) {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new Error('Trip not found');

        const activeMembers = trip.members.filter((m: any) => m.isActive);
        const expenses = await Expense.find({ tripId: new Types.ObjectId(tripId) });

        // Calculate per-member spending
        const memberSpending = activeMembers.map((member: any) => {
            const memberExpenses = expenses.filter((e) => e.paidBy === member.userId);
            const totalPaid = memberExpenses.reduce((s, e) => s + e.amountBase, 0);
            const splitsPaid = expenses.reduce((s, e) => {
                const split = e.splits.find((sp: any) => sp.userId === member.userId);
                return s + (split?.amountBase || 0);
            }, 0);
            return {
                userId: member.userId,
                displayName: member.displayName,
                totalPaid,
                totalOwed: splitsPaid,
                netSpending: totalPaid - splitsPaid,
            };
        });

        const averageSpending = memberSpending.reduce((s, m) => s + m.netSpending, 0) / memberSpending.length;
        const mySpending = memberSpending.find((m) => m.userId === userId);
        const highestSpender = memberSpending.reduce((max, m) => m.netSpending > max.netSpending ? m : max, memberSpending[0]);
        const lowestSpender = memberSpending.reduce((min, m) => m.netSpending < min.netSpending ? m : min, memberSpending[0]);

        return {
            mySpending: mySpending?.netSpending || 0,
            averageSpending,
            difference: (mySpending?.netSpending || 0) - averageSpending,
            highestSpender: { name: highestSpender.displayName, amount: highestSpender.netSpending },
            lowestSpender: { name: lowestSpender.displayName, amount: lowestSpender.netSpending },
            totalMembers: memberSpending.length,
            members: memberSpending.sort((a, b) => b.netSpending - a.netSpending),
        };
    },

    /**
     * Get spending trends over time.
     */
    async getSpendingTrends(userId: string) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyData = await Expense.aggregate([
            {
                $match: {
                    $or: [{ paidBy: userId }, { 'splits.userId': userId }],
                    date: { $gte: sixMonthsAgo },
                },
            },
            {
                $group: {
                    _id: { year: { $year: '$date' }, month: { $month: '$date' } },
                    totalSpent: { $sum: '$amountBase' },
                    count: { $sum: 1 },
                    avgPerExpense: { $avg: '$amountBase' },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        // Calculate trend
        const trends = monthlyData.map((m, i) => {
            const prevMonth = i > 0 ? monthlyData[i - 1] : null;
            const change = prevMonth
                ? parseFloat((((m.totalSpent - prevMonth.totalSpent) / prevMonth.totalSpent) * 100).toFixed(1))
                : 0;

            return {
                month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
                totalSpent: m.totalSpent,
                count: m.count,
                avgPerExpense: parseFloat(m.avgPerExpense.toFixed(2)),
                changeFromPrevious: change,
                trend: change > 10 ? 'rising' : change < -10 ? 'falling' : 'stable',
            };
        });

        const overallTrend = trends.length >= 3
            ? this.calculateTrendDirection(trends.slice(-3))
            : 'stable';

        return {
            trends,
            overallTrend,
            averageMonthly: trends.reduce((s, t) => s + t.totalSpent, 0) / Math.max(1, trends.length),
            insight: this.generateTrendInsight(overallTrend, trends),
        };
    },

    // Helpers
    groupByCategory(expenses: any[]): Record<string, number> {
        return expenses.reduce((acc: Record<string, number>, e: any) => {
            acc[e.category] = (acc[e.category] || 0) + e.amountBase;
            return acc;
        }, {});
    },

    generateInsights(comparisons: any[], currentTotal: number, currentDays: number): string[] {
        const insights: string[] = [];

        if (comparisons.length > 0) {
            const avgPrevious = comparisons.reduce((s, c) => s + c.perDay, 0) / comparisons.length;
            const currentPerDay = currentTotal / Math.max(1, currentDays);
            const diff = avgPrevious - currentPerDay;

            if (diff > 0) {
                insights.push(`You're spending ₹${Math.abs(diff).toFixed(0)}/day LESS than your average trip. Great job! 🎉`);
            } else if (diff < 0) {
                insights.push(`You're spending ₹${Math.abs(diff).toFixed(0)}/day MORE than your average trip.`);
            }

            if (comparisons.length >= 2) {
                insights.push(`This is your ${comparisons.length + 1}th trip. You're becoming a pro traveler! ✈️`);
            }
        }

        return insights;
    },

    calculateTrendDirection(trends: any[]): string {
        const changes = trends.map((t) => t.changeFromPrevious);
        const avgChange = changes.reduce((s, c) => s + c, 0) / changes.length;
        if (avgChange > 5) return 'rising';
        if (avgChange < -5) return 'falling';
        return 'stable';
    },

    generateTrendInsight(overallTrend: string, trends: any[]): string {
        const lastMonth = trends[trends.length - 1];
        switch (overallTrend) {
            case 'rising':
                return `Your spending has been increasing. Last month: ₹${lastMonth?.totalSpent?.toLocaleString() || 0}`;
            case 'falling':
                return `You're spending less over time. Last month: ₹${lastMonth?.totalSpent?.toLocaleString() || 0}. Keep it up!`;
            default:
                return 'Your spending is stable month-to-month.';
        }
    },
};
import { Types } from 'mongoose';
import { Trip, ITrip } from './trip.model';
import { Expense, IExpense } from '../expense/expense.model';
import { Stop } from './stop.model';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';

// ============================================================
// TYPES
// ============================================================

interface SpendingPattern {
    mostExpensiveDay: { date: Date; amount: number; expenseCount: number };
    cheapestDay: { date: Date; amount: number; expenseCount: number };
    averageDailySpend: number;
    weekendVsWeekday: { weekend: number; weekday: number; weekendAvg: number; weekdayAvg: number };
    spendingTrend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    highestSpendingHour: { hour: number; amount: number };
}

interface CategoryInsight {
    topCategory: string;
    topCategoryAmount: number;
    topCategoryPercent: number;
    categoryRanking: { category: string; amount: number; percent: number; count: number }[];
    unusualSpikes: { category: string; date: Date; amount: number; percentAboveAverage: number }[];
    categoryDiversity: number; // 0-100, higher = more diverse spending
}

interface MemberInsight {
    biggestSpender: { userId: string; displayName: string; amount: number; percentOfTotal: number };
    mostFrugal: { userId: string; displayName: string; amount: number; percentOfTotal: number };
    splitEquality: number; // 0-100, 100 = perfectly equal
    payerFrequency: { userId: string; displayName: string; count: number; totalAmount: number }[];
    debtDistribution: { userId: string; displayName: string; owes: number; isOwed: number; net: number }[];
}

interface Prediction {
    estimatedFinalCost: number;
    budgetStatus: 'under' | 'on_track' | 'over' | 'no_budget';
    projectedOverspend: number;
    dailyBurnRate: number;
    daysRemaining: number;
    confidence: number; // 0-100
}

interface Recommendation {
    type: 'save_money' | 'balance_splits' | 'budget_warning' | 'optimize_category' | 'settlement_tip';
    priority: 'high' | 'medium' | 'low';
    icon: string;
    message: string;
    detail?: string;
    potentialSavings?: number;
    actionable: boolean;
    action?: { type: string; data: any };
}

export interface TripInsights {
    tripId: string;
    tripTitle: string;
    generatedAt: Date;
    spendingPatterns: SpendingPattern;
    categoryInsights: CategoryInsight;
    memberInsights: MemberInsight;
    predictions: Prediction;
    recommendations: Recommendation[];
    funFacts: string[];
}

// ============================================================
// INSIGHTS SERVICE
// ============================================================

export const tripInsightsService = {
    /**
     * Generate comprehensive trip insights.
     */
    async getTripInsights(tripId: string, userId: string): Promise<TripInsights> {
        const trip = await Trip.findById(tripId).populate('stops');
        if (!trip) throw new AppError('Trip not found', 404);
        if (!trip.isMember(userId)) throw new AppError('Not a member of this trip', 403);

        const expenses = await Expense.find({
            tripId: new Types.ObjectId(tripId),
            isArchived: false,
        }).lean();

        if (expenses.length === 0) {
            return this._generateEmptyInsights(trip);
        }

        const spendingPatterns = this._analyzeSpendingPatterns(expenses, trip);
        const categoryInsights = this._analyzeCategories(expenses);
        const memberInsights = this._analyzeMemberBehavior(expenses, trip);
        const predictions = this._predictFinalCost(expenses, trip);
        const recommendations = this._generateRecommendations(
            expenses, trip, spendingPatterns, categoryInsights, memberInsights, predictions
        );
        const funFacts = this._generateFunFacts(expenses, trip, memberInsights, categoryInsights);

        return {
            tripId: trip._id.toString(),
            tripTitle: trip.title,
            generatedAt: new Date(),
            spendingPatterns,
            categoryInsights,
            memberInsights,
            predictions,
            recommendations,
            funFacts,
        };
    },

    // ============================================================
    // SPENDING PATTERNS
    // ============================================================

    _analyzeSpendingPatterns(expenses: any[], trip: any): SpendingPattern {
        // Group by date
        const dailySpending: Record<string, { amount: number; count: number }> = {};
        const hourlySpending: Record<number, number> = {};

        expenses.forEach(e => {
            const dateKey = new Date(e.date).toISOString().split('T')[0];
            if (!dailySpending[dateKey]) {
                dailySpending[dateKey] = { amount: 0, count: 0 };
            }
            dailySpending[dateKey].amount += e.amountBase;
            dailySpending[dateKey].count += 1;

            const hour = new Date(e.date).getHours();
            hourlySpending[hour] = (hourlySpending[hour] || 0) + e.amountBase;
        });

        // Most/cheapest day
        const days = Object.entries(dailySpending).map(([date, data]) => ({
            date: new Date(date),
            amount: data.amount,
            expenseCount: data.count,
        }));

        const mostExpensiveDay = days.reduce((max, d) => d.amount > max.amount ? d : max, days[0]);
        const cheapestDay = days.reduce((min, d) => d.amount < min.amount ? d : min, days[0]);

        // Average daily spend
        const tripDuration = Math.max(
            1,
            Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000)
        );
        const totalSpent = expenses.reduce((sum, e) => sum + e.amountBase, 0);
        const averageDailySpend = totalSpent / tripDuration;

        // Weekend vs Weekday
        let weekendTotal = 0;
        let weekendDays = 0;
        let weekdayTotal = 0;
        let weekdayDays = 0;

        days.forEach(d => {
            const dayOfWeek = d.date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                weekendTotal += d.amount;
                weekendDays++;
            } else {
                weekdayTotal += d.amount;
                weekdayDays++;
            }
        });

        // Spending trend
        const sortedDays = days.sort((a, b) => a.date.getTime() - b.date.getTime());
        const firstHalf = sortedDays.slice(0, Math.ceil(sortedDays.length / 2));
        const secondHalf = sortedDays.slice(Math.ceil(sortedDays.length / 2));
        const firstHalfAvg = firstHalf.reduce((s, d) => s + d.amount, 0) / Math.max(firstHalf.length, 1);
        const secondHalfAvg = secondHalf.reduce((s, d) => s + d.amount, 0) / Math.max(secondHalf.length, 1);

        let spendingTrend: SpendingPattern['spendingTrend'] = 'stable';
        if (secondHalfAvg > firstHalfAvg * 1.2) spendingTrend = 'increasing';
        else if (secondHalfAvg < firstHalfAvg * 0.8) spendingTrend = 'decreasing';
        else if (Math.abs(secondHalfAvg - firstHalfAvg) > firstHalfAvg * 0.5) spendingTrend = 'volatile';

        // Highest spending hour
        const highestHour = Object.entries(hourlySpending).reduce(
            (max, [hour, amount]) => amount > max.amount ? { hour: parseInt(hour), amount } : max,
            { hour: 0, amount: 0 }
        );

        return {
            mostExpensiveDay,
            cheapestDay,
            averageDailySpend: parseFloat(averageDailySpend.toFixed(2)),
            weekendVsWeekday: {
                weekend: parseFloat(weekendTotal.toFixed(2)),
                weekday: parseFloat(weekdayTotal.toFixed(2)),
                weekendAvg: weekendDays > 0 ? parseFloat((weekendTotal / weekendDays).toFixed(2)) : 0,
                weekdayAvg: weekdayDays > 0 ? parseFloat((weekdayTotal / weekdayDays).toFixed(2)) : 0,
            },
            spendingTrend,
            highestSpendingHour: {
                hour: highestHour.hour,
                amount: parseFloat(highestHour.amount.toFixed(2)),
            },
        };
    },

    // ============================================================
    // CATEGORY INSIGHTS
    // ============================================================

    _analyzeCategories(expenses: any[]): CategoryInsight {
        const categoryData: Record<string, { amount: number; count: number; dates: Date[] }> = {};

        expenses.forEach(e => {
            const cat = e.category || 'other';
            if (!categoryData[cat]) {
                categoryData[cat] = { amount: 0, count: 0, dates: [] };
            }
            categoryData[cat].amount += e.amountBase;
            categoryData[cat].count += 1;
            categoryData[cat].dates.push(new Date(e.date));
        });

        const totalSpent = expenses.reduce((sum, e) => sum + e.amountBase, 0);
        const categories = Object.keys(categoryData);

        // Ranking
        const categoryRanking = Object.entries(categoryData)
            .map(([category, data]) => ({
                category,
                amount: parseFloat(data.amount.toFixed(2)),
                percent: parseFloat(((data.amount / totalSpent) * 100).toFixed(1)),
                count: data.count,
            }))
            .sort((a, b) => b.amount - a.amount);

        const topCategory = categoryRanking[0];

        // Unusual spikes (expenses > 2x average for that category)
        const unusualSpikes: CategoryInsight['unusualSpikes'] = [];
        Object.entries(categoryData).forEach(([category, data]) => {
            const avgPerExpense = data.amount / data.count;
            expenses
                .filter(e => e.category === category && e.amountBase > avgPerExpense * 2)
                .forEach(e => {
                    unusualSpikes.push({
                        category,
                        date: e.date,
                        amount: e.amountBase,
                        percentAboveAverage: parseFloat(((e.amountBase / avgPerExpense - 1) * 100).toFixed(0)),
                    });
                });
        });
        unusualSpikes.sort((a, b) => b.percentAboveAverage - a.percentAboveAverage);

        // Category diversity (how evenly spending is distributed)
        const maxPossibleEntropy = Math.log(categories.length || 1);
        const actualEntropy = categories.reduce((sum, cat) => {
            const p = categoryData[cat].amount / totalSpent;
            return sum - (p > 0 ? p * Math.log(p) : 0);
        }, 0);
        const categoryDiversity = maxPossibleEntropy > 0
            ? parseFloat(((actualEntropy / maxPossibleEntropy) * 100).toFixed(0))
            : 0;

        return {
            topCategory: topCategory?.category || 'other',
            topCategoryAmount: topCategory?.amount || 0,
            topCategoryPercent: topCategory?.percent || 0,
            categoryRanking,
            unusualSpikes: unusualSpikes.slice(0, 5),
            categoryDiversity,
        };
    },

    // ============================================================
    // MEMBER INSIGHTS
    // ============================================================

    _analyzeMemberBehavior(expenses: any[], trip: any): MemberInsight {
        const activeMembers = trip.members.filter((m: any) => m.isActive);
        const memberMap = new Map<string, string>(activeMembers.map((m: any) => [m.userId as string, m.displayName as string]));

        // Payer stats
        const payerStats: Record<string, { count: number; totalAmount: number }> = {};
        activeMembers.forEach((m: any) => {
            payerStats[m.userId] = { count: 0, totalAmount: 0 };
        });

        expenses.forEach(e => {
            if (payerStats[e.paidBy]) {
                payerStats[e.paidBy].count += 1;
                payerStats[e.paidBy].totalAmount += e.amountBase;
            }
        });

        // Biggest spender & most frugal
        const payers = Object.entries(payerStats)
            .map(([userId, data]) => ({
                userId,
                displayName: memberMap.get(userId) || 'Unknown',
                amount: parseFloat(data.totalAmount.toFixed(2)),
                percentOfTotal: 0,
                count: data.count,
            }))
            .sort((a, b) => b.amount - a.amount);

        const totalPaid = payers.reduce((s, p) => s + p.amount, 0);
        payers.forEach(p => {
            p.percentOfTotal = totalPaid > 0 ? parseFloat(((p.amount / totalPaid) * 100).toFixed(1)) : 0;
        });

        const biggestSpenderRaw = payers[0] || { userId: '', displayName: '', amount: 0, percentOfTotal: 0, count: 0 };
        const mostFrugalRaw = payers[payers.length - 1] || { userId: '', displayName: '', amount: 0, percentOfTotal: 0, count: 0 };

        const biggestSpender = {
            userId: biggestSpenderRaw.userId,
            displayName: biggestSpenderRaw.displayName,
            amount: biggestSpenderRaw.amount,
            percentOfTotal: biggestSpenderRaw.percentOfTotal
        };

        const mostFrugal = {
            userId: mostFrugalRaw.userId,
            displayName: mostFrugalRaw.displayName,
            amount: mostFrugalRaw.amount,
            percentOfTotal: mostFrugalRaw.percentOfTotal
        };

        // Split equality (Gini coefficient style)
        const avgPaid = totalPaid / Math.max(activeMembers.length, 1);
        const sumAbsDeviations = payers.reduce((sum, p) => sum + Math.abs(p.amount - avgPaid), 0);
        const maxPossibleDeviation = avgPaid * (activeMembers.length - 1) * 2;
        const splitEquality = maxPossibleDeviation > 0
            ? parseFloat(((1 - sumAbsDeviations / maxPossibleDeviation) * 100).toFixed(0))
            : 100;

        // Debt distribution
        const balances: Record<string, { owes: number; isOwed: number }> = {};
        activeMembers.forEach((m: any) => {
            balances[m.userId] = { owes: 0, isOwed: 0 };
        });

        expenses.forEach(e => {
            e.splits.forEach((s: any) => {
                if (!s.isPaid) {
                    if (balances[s.userId]) balances[s.userId].owes += s.amountBase;
                    if (balances[e.paidBy]) balances[e.paidBy].isOwed += s.amountBase;
                }
            });
        });

        const debtDistribution = Object.entries(balances).map(([userId, data]) => ({
            userId,
            displayName: memberMap.get(userId) || 'Unknown',
            owes: parseFloat(data.owes.toFixed(2)),
            isOwed: parseFloat(data.isOwed.toFixed(2)),
            net: parseFloat((data.isOwed - data.owes).toFixed(2)),
        }));

        const payerFrequency = payers.map(p => ({
            userId: p.userId,
            displayName: p.displayName,
            count: p.count,
            totalAmount: p.amount
        }));

        return {
            biggestSpender,
            mostFrugal,
            splitEquality: Math.max(0, Math.min(100, splitEquality)),
            payerFrequency,
            debtDistribution,
        };
    },

    // ============================================================
    // PREDICTIONS
    // ============================================================

    _predictFinalCost(expenses: any[], trip: any): Prediction {
        const totalSpent = expenses.reduce((sum, e) => sum + e.amountBase, 0);
        const tripStart = new Date(trip.startDate).getTime();
        const tripEnd = new Date(trip.endDate).getTime();
        const now = Date.now();

        const totalDuration = Math.max(1, Math.ceil((tripEnd - tripStart) / 86400000));
        const elapsedDays = Math.max(1, Math.ceil((now - tripStart) / 86400000));
        const daysRemaining = Math.max(0, totalDuration - elapsedDays);

        const dailyBurnRate = totalSpent / elapsedDays;
        const estimatedFinalCost = totalSpent + (dailyBurnRate * daysRemaining);

        let budgetStatus: Prediction['budgetStatus'] = 'no_budget';
        let projectedOverspend = 0;

        if (trip.totalBudget) {
            if (estimatedFinalCost <= trip.totalBudget * 0.9) budgetStatus = 'under';
            else if (estimatedFinalCost <= trip.totalBudget * 1.05) budgetStatus = 'on_track';
            else budgetStatus = 'over';
            projectedOverspend = Math.max(0, estimatedFinalCost - trip.totalBudget);
        }

        // Confidence based on how far into the trip we are
        const confidence = Math.min(95, Math.round((elapsedDays / totalDuration) * 100));

        return {
            estimatedFinalCost: parseFloat(estimatedFinalCost.toFixed(2)),
            budgetStatus,
            projectedOverspend: parseFloat(projectedOverspend.toFixed(2)),
            dailyBurnRate: parseFloat(dailyBurnRate.toFixed(2)),
            daysRemaining,
            confidence,
        };
    },

    // ============================================================
    // RECOMMENDATIONS
    // ============================================================

    _generateRecommendations(
        expenses: any[],
        trip: any,
        spending: SpendingPattern,
        categories: CategoryInsight,
        members: MemberInsight,
        predictions: Prediction
    ): Recommendation[] {
        const recs: Recommendation[] = [];

        // Budget warnings
        if (predictions.budgetStatus === 'over') {
            recs.push({
                type: 'budget_warning',
                priority: 'high',
                icon: '🚨',
                message: `You're projected to overspend by ${trip.baseCurrency} ${predictions.projectedOverspend.toLocaleString()}`,
                detail: `Try reducing spending in your top category: ${categories.topCategory}`,
                potentialSavings: predictions.projectedOverspend,
                actionable: true,
                action: { type: 'view_category', data: { category: categories.topCategory } },
            });
        }

        // Top category spending
        if (categories.topCategoryPercent > 50) {
            recs.push({
                type: 'optimize_category',
                priority: 'medium',
                icon: '📊',
                message: `${categories.topCategoryPercent}% of spending is on ${categories.topCategory}`,
                detail: 'Consider setting a category budget to control spending',
                actionable: true,
                action: { type: 'set_category_budget', data: { category: categories.topCategory } },
            });
        }

        // Balance splits
        if (members.splitEquality < 60) {
            recs.push({
                type: 'balance_splits',
                priority: 'medium',
                icon: '⚖️',
                message: `Spending is uneven — ${members.biggestSpender.displayName} has paid ${members.biggestSpender.percentOfTotal}%`,
                detail: 'Use settlement to balance things out',
                actionable: true,
                action: { type: 'view_settlement', data: { tripId: trip._id } },
            });
        }

        // Weekend overspending
        if (spending.weekendVsWeekday.weekendAvg > spending.weekendVsWeekday.weekdayAvg * 1.5) {
            recs.push({
                type: 'save_money',
                priority: 'low',
                icon: '💡',
                message: 'Weekend spending is 50%+ higher than weekdays',
                detail: 'Plan free/low-cost activities for weekends',
                potentialSavings: parseFloat(
                    ((spending.weekendVsWeekday.weekendAvg - spending.weekendVsWeekday.weekdayAvg) * 0.3).toFixed(2)
                ),
                actionable: false,
            });
        }

        // Settlement tip
        const unsettledCount = expenses.filter(e => !e.isSettled).length;
        if (unsettledCount > 5 && trip.status === 'active') {
            recs.push({
                type: 'settlement_tip',
                priority: 'low',
                icon: '🤝',
                message: `${unsettledCount} expenses still need settling`,
                detail: 'Settle up regularly to avoid a big bill at the end',
                actionable: true,
                action: { type: 'view_settlement', data: { tripId: trip._id } },
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return recs.slice(0, 5);
    },

    // ============================================================
    // FUN FACTS
    // ============================================================

    _generateFunFacts(
        expenses: any[],
        trip: any,
        members: MemberInsight,
        categories: CategoryInsight
    ): string[] {
        const facts: string[] = [];

        if (expenses.length > 0) {
            const totalSpent = expenses.reduce((s, e) => s + e.amountBase, 0);
            facts.push(`💰 Total trip spending: ${trip.baseCurrency} ${totalSpent.toLocaleString()}`);

            const avgPerExpense = totalSpent / expenses.length;
            facts.push(`📝 Average expense: ${trip.baseCurrency} ${avgPerExpense.toFixed(0)}`);

            if (categories.topCategory === 'food') {
                facts.push('🍕 Food was the biggest expense — you ate well!');
            } else if (categories.topCategory === 'stay') {
                facts.push('🏨 Accommodation took the biggest chunk of your budget');
            } else if (categories.topCategory === 'transport') {
                facts.push('🚗 Getting around cost more than anything else');
            }
        }

        if (members.biggestSpender.displayName) {
            facts.push(`🏆 ${members.biggestSpender.displayName} is the group's biggest spender`);
        }

        if (members.splitEquality > 80) {
            facts.push('🤝 Your group splits expenses very fairly!');
        }

        const nightExpenses = expenses.filter(e => {
            const hour = new Date(e.date).getHours();
            return hour >= 22 || hour <= 4;
        });
        if (nightExpenses.length > 3) {
            facts.push(`🌙 ${nightExpenses.length} late-night expenses — night owls!`);
        }

        const uniqueDays = new Set(expenses.map(e => new Date(e.date).toISOString().split('T')[0])).size;
        facts.push(`📅 Expenses tracked across ${uniqueDays} different days`);

        return facts;
    },

    _generateEmptyInsights(trip: any): TripInsights {
        return {
            tripId: trip._id.toString(),
            tripTitle: trip.title,
            generatedAt: new Date(),
            spendingPatterns: {
                mostExpensiveDay: { date: new Date(), amount: 0, expenseCount: 0 },
                cheapestDay: { date: new Date(), amount: 0, expenseCount: 0 },
                averageDailySpend: 0,
                weekendVsWeekday: { weekend: 0, weekday: 0, weekendAvg: 0, weekdayAvg: 0 },
                spendingTrend: 'stable',
                highestSpendingHour: { hour: 0, amount: 0 },
            },
            categoryInsights: {
                topCategory: 'none',
                topCategoryAmount: 0,
                topCategoryPercent: 0,
                categoryRanking: [],
                unusualSpikes: [],
                categoryDiversity: 0,
            },
            memberInsights: {
                biggestSpender: { userId: '', displayName: '', amount: 0, percentOfTotal: 0 },
                mostFrugal: { userId: '', displayName: '', amount: 0, percentOfTotal: 0 },
                splitEquality: 100,
                payerFrequency: [],
                debtDistribution: [],
            },
            predictions: {
                estimatedFinalCost: 0,
                budgetStatus: 'no_budget',
                projectedOverspend: 0,
                dailyBurnRate: 0,
                daysRemaining: 0,
                confidence: 0,
            },
            recommendations: [{
                type: 'save_money',
                priority: 'low',
                icon: '📝',
                message: 'Start adding expenses to unlock insights!',
                actionable: false,
            }],
            funFacts: ['Start your trip and add expenses to see fun facts! 🚀'],
        };
    },
};


// import { Trip, ITrip } from './trip.model';
// import { Expense, IExpense } from '../expense/expense.model';
// import { AppError } from '../../shared/errors/AppError';

// // ─────────────────────────────────────────────────────────────────────────────
// // TYPES
// // ─────────────────────────────────────────────────────────────────────────────

// export interface TripInsights {
//     spendingPatterns: {
//         mostExpensiveDay: { date: Date | null; amount: number };
//         cheapestDay: { date: Date | null; amount: number };
//         averageDailySpend: number;
//         weekendVsWeekday: { weekend: number; weekday: number };
//     };
//     categoryInsights: {
//         topCategory: string;
//         topCategoryPercent: number;
//         unusualSpikes: { category: string; date: Date; amount: number; percentAboveAverage: number }[];
//     };
//     memberInsights: {
//         biggestSpender: { userId: string; displayName: string; amount: number } | null;
//         mostFrugal: { userId: string; displayName: string; amount: number } | null;
//         splitEquality: number; // 0-100, how evenly expenses are distributed
//     };
//     predictions: {
//         estimatedFinalCost: number;
//         budgetStatus: 'under' | 'on_track' | 'over';
//         projectedOverspend: number;
//     };
//     recommendations: {
//         type: 'save_money' | 'balance_splits' | 'budget_warning';
//         message: string;
//         potentialSavings?: number;
//     }[];
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // MAIN SERVICE EXPORTS
// // ─────────────────────────────────────────────────────────────────────────────

// export const getTripInsights = async (tripId: string): Promise<TripInsights> => {
//     const trip = await Trip.findById(tripId).lean();
//     if (!trip) {
//         throw new AppError('Trip not found', 404);
//     }

//     const expenses = await Expense.find({ tripId, isArchived: false }).lean();

//     return {
//         spendingPatterns: analyzeSpendingPatterns(expenses as unknown as IExpense[], trip as unknown as ITrip),
//         categoryInsights: analyzeCategories(expenses as unknown as IExpense[]),
//         memberInsights: analyzeMemberBehavior(expenses as unknown as IExpense[], trip as unknown as ITrip),
//         predictions: predictFinalCost(expenses as unknown as IExpense[], trip as unknown as ITrip),
//         recommendations: generateRecommendations(expenses as unknown as IExpense[], trip as unknown as ITrip),
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────────────────────────────────────

// function analyzeSpendingPatterns(expenses: IExpense[], trip: ITrip) {
//     if (expenses.length === 0) {
//         return {
//             mostExpensiveDay: { date: null, amount: 0 },
//             cheapestDay: { date: null, amount: 0 },
//             averageDailySpend: 0,
//             weekendVsWeekday: { weekend: 0, weekday: 0 },
//         };
//     }

//     const dailySpend = new Map<string, number>();
//     let totalSpend = 0;
//     let weekendSpend = 0;
//     let weekdaySpend = 0;

//     expenses.forEach((e) => {
//         const dateStr = new Date(e.date).toISOString().split('T')[0];
//         const amount = e.amountBase;
//         totalSpend += amount;

//         dailySpend.set(dateStr, (dailySpend.get(dateStr) || 0) + amount);

//         const dayOfWeek = new Date(e.date).getDay();
//         if (dayOfWeek === 0 || dayOfWeek === 6) {
//             weekendSpend += amount;
//         } else {
//             weekdaySpend += amount;
//         }
//     });

//     let maxAmount = -1;
//     let maxDateStr = '';
//     let minAmount = Infinity;
//     let minDateStr = '';

//     for (const [dateStr, amount] of dailySpend.entries()) {
//         if (amount > maxAmount) {
//             maxAmount = amount;
//             maxDateStr = dateStr;
//         }
//         if (amount < minAmount) {
//             minAmount = amount;
//             minDateStr = dateStr;
//         }
//     }

//     const days = dailySpend.size || 1;

//     return {
//         mostExpensiveDay: { date: maxDateStr ? new Date(maxDateStr) : null, amount: maxAmount },
//         cheapestDay: { date: minDateStr ? new Date(minDateStr) : null, amount: minAmount === Infinity ? 0 : minAmount },
//         averageDailySpend: totalSpend / days,
//         weekendVsWeekday: { weekend: weekendSpend, weekday: weekdaySpend },
//     };
// }

// function analyzeCategories(expenses: IExpense[]) {
//     if (expenses.length === 0) {
//         return { topCategory: 'none', topCategoryPercent: 0, unusualSpikes: [] };
//     }

//     const catSpend = new Map<string, number>();
//     let totalSpend = 0;

//     expenses.forEach((e) => {
//         const amount = e.amountBase;
//         totalSpend += amount;
//         catSpend.set(e.category, (catSpend.get(e.category) || 0) + amount);
//     });

//     let topCategory = 'none';
//     let topSpend = 0;

//     for (const [cat, amount] of catSpend.entries()) {
//         if (amount > topSpend) {
//             topSpend = amount;
//             topCategory = cat;
//         }
//     }

//     const topCategoryPercent = totalSpend > 0 ? (topSpend / totalSpend) * 100 : 0;

//     return {
//         topCategory,
//         topCategoryPercent,
//         unusualSpikes: [], // Add statistical calculation here if needed
//     };
// }

// function analyzeMemberBehavior(expenses: IExpense[], trip: ITrip) {
//     if (expenses.length === 0 || trip.members.length === 0) {
//         return { biggestSpender: null, mostFrugal: null, splitEquality: 100 };
//     }

//     const memberSpend = new Map<string, { displayName: string; amount: number }>();

//     trip.members.forEach((m) => {
//         memberSpend.set(m.userId, { displayName: m.displayName, amount: 0 });
//     });

//     // Determine who paid what
//     expenses.forEach((e) => {
//         const existing = memberSpend.get(e.paidBy);
//         if (existing) {
//             existing.amount += e.amountBase;
//         } else {
//             memberSpend.set(e.paidBy, { displayName: e.paidByName || e.paidBy, amount: e.amountBase });
//         }
//     });

//     let maxSpend = -1;
//     let maxSpender = null;
//     let minSpend = Infinity;
//     let minSpender = null;

//     for (const [userId, data] of memberSpend.entries()) {
//         if (data.amount > maxSpend) {
//             maxSpend = data.amount;
//             maxSpender = { userId, displayName: data.displayName, amount: data.amount };
//         }
//         if (data.amount < minSpend) {
//             minSpend = data.amount;
//             minSpender = { userId, displayName: data.displayName, amount: data.amount };
//         }
//     }

//     return {
//         biggestSpender: maxSpender,
//         mostFrugal: minSpender,
//         splitEquality: 85, // Dummy heuristic for now
//     };
// }

// function predictFinalCost(expenses: IExpense[], trip: ITrip) {
//     const totalSpend = expenses.reduce((sum, e) => sum + e.amountBase, 0);
//     return {
//         estimatedFinalCost: totalSpend * 1.1, // Dummy logic
//         budgetStatus: 'on_track' as const,
//         projectedOverspend: 0,
//     };
// }

// function generateRecommendations(expenses: IExpense[], trip: ITrip) {
//     if (expenses.length === 0) return [];
    
//     return [
//         {
//             type: 'save_money' as const,
//             message: 'Consider cooking one meal a day to save up to 20% on food expenses.',
//             potentialSavings: 500,
//         }
//     ];
// }

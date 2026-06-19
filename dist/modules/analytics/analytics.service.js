"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = exports.AnalyticsService = void 0;
const expense_model_1 = require("../expense/expense.model");
const trip_model_1 = require("../trips/trip.model");
const settlement_model_1 = require("../settlement/settlement.model");
const AppError_1 = require("../../shared/errors/AppError");
const redis_1 = require("../../config/redis");
class AnalyticsService {
    /**
     * Get comprehensive user analytics
     */
    async getUserAnalytics(userId, timeframe = 'month') {
        const dateFilter = this.getTimeframeFilter(timeframe);
        const cacheKey = `analytics:user:${userId}:${timeframe}`;
        const cached = await redis_1.redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        // Get consumption vs payment data
        const consumptionVsPayment = await this.getConsumptionVsPayment(userId, dateFilter);
        // Get category breakdown
        const categoryBreakdown = await this.getCategoryBreakdown(userId, dateFilter);
        // Get spending trends
        const spendingTrends = await this.getSpendingTrends(userId, timeframe);
        // Get settlement efficiency
        const settlementEfficiency = await this.getSettlementEfficiency(userId, dateFilter);
        // Get trip insights
        const tripInsights = await this.getTripInsights(userId, dateFilter);
        const analytics = {
            timeframe,
            summary: {
                totalConsumed: consumptionVsPayment.totalConsumed,
                totalPaid: consumptionVsPayment.totalPaid,
                netPosition: consumptionVsPayment.netPosition,
                expenseCount: consumptionVsPayment.expenseCount,
                averageExpense: consumptionVsPayment.averageExpense
            },
            consumptionVsPayment,
            categoryBreakdown,
            spendingTrends,
            settlementEfficiency,
            tripInsights,
            generatedAt: new Date().toISOString()
        };
        // Cache for 2 hours
        await redis_1.redisClient.set(cacheKey, JSON.stringify(analytics), 7200);
        return analytics;
    }
    /**
     * Get trip analytics
     */
    async getTripAnalytics(tripId, userId, timeframe = 'month') {
        // Verify trip membership
        const trip = await trip_model_1.Trip.findById(tripId);
        if (!trip || !trip.isMember(userId)) {
            throw new AppError_1.NotFoundError('Trip not found or you are not a member');
        }
        const dateFilter = this.getTimeframeFilter(timeframe);
        const cacheKey = `analytics:trip:${tripId}:${timeframe}`;
        const cached = await redis_1.redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        // Get trip spending overview
        const overview = await this.getTripOverview(trip._id, dateFilter);
        // Get member contributions
        const memberContributions = await this.getMemberContributions(trip._id, dateFilter);
        // Get category distribution
        const categoryDistribution = await this.getTripCategoryDistribution(trip._id, dateFilter);
        // Get expense timeline
        const expenseTimeline = await this.getExpenseTimeline(trip._id, timeframe);
        // Get settlement status
        const settlementStatus = await this.getTripSettlementStatus(trip._id);
        const analytics = {
            timeframe,
            overview,
            memberContributions,
            categoryDistribution,
            expenseTimeline,
            settlementStatus,
            tripCurrency: trip.baseCurrency,
            generatedAt: new Date().toISOString()
        };
        // Cache for 1 hour
        await redis_1.redisClient.set(cacheKey, JSON.stringify(analytics), 3600);
        return analytics;
    }
    /**
     * Get predictive analytics
     */
    async getPredictiveAnalytics(userId, tripId) {
        const trip = await trip_model_1.Trip.findById(tripId);
        if (!trip || !trip.isMember(userId)) {
            throw new AppError_1.NotFoundError('Trip not found or you are not a member');
        }
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const expenses = await expense_model_1.Expense.aggregate([
            {
                $match: {
                    tripId: trip._id,
                    'splits.userId': userId,
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: '$createdAt' },
                        year: { $year: '$createdAt' },
                        category: '$category'
                    },
                    totalAmount: { $sum: '$amountBase' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        // Simple linear regression for predictions
        const predictions = this.calculatePredictions(expenses);
        return {
            historicalData: expenses,
            predictions,
            currency: trip.baseCurrency,
            generatedAt: new Date().toISOString()
        };
    }
    /**
     * Consumption vs Payment analysis (WAKERU EXCLUSIVE)
     */
    async getConsumptionVsPayment(userId, dateFilter) {
        const pipeline = [
            {
                $match: {
                    $or: [
                        { 'splits.userId': userId },
                        { paidBy: userId }
                    ],
                    createdAt: { $gte: dateFilter }
                }
            },
            {
                $facet: {
                    consumption: [
                        { $unwind: '$splits' },
                        { $match: { 'splits.userId': userId } },
                        {
                            $group: {
                                _id: null,
                                totalConsumed: { $sum: '$splits.amountBase' },
                                categories: { $addToSet: '$category' }
                            }
                        }
                    ],
                    payments: [
                        { $match: { paidBy: userId } },
                        {
                            $group: {
                                _id: null,
                                totalPaid: { $sum: '$amountBase' },
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    stats: [
                        { $unwind: '$splits' },
                        { $match: { 'splits.userId': userId } },
                        {
                            $group: {
                                _id: null,
                                totalExpenses: { $sum: 1 },
                                averageAmount: { $avg: '$splits.amountBase' },
                                maxAmount: { $max: '$splits.amountBase' },
                                minAmount: { $min: '$splits.amountBase' }
                            }
                        }
                    ]
                }
            }
        ];
        const [result] = await expense_model_1.Expense.aggregate(pipeline);
        const totalConsumed = result.consumption[0]?.totalConsumed || 0;
        const totalPaid = result.payments[0]?.totalPaid || 0;
        const stats = result.stats[0] || {};
        return {
            totalConsumed: Math.round(totalConsumed * 100) / 100,
            totalPaid: Math.round(totalPaid * 100) / 100,
            netPosition: Math.round((totalPaid - totalConsumed) * 100) / 100,
            expenseCount: stats.totalExpenses || 0,
            averageExpense: Math.round((stats.averageAmount || 0) * 100) / 100,
            maxExpense: Math.round((stats.maxAmount || 0) * 100) / 100,
            minExpense: Math.round((stats.minAmount || 0) * 100) / 100
        };
    }
    /**
     * Category breakdown
     */
    async getCategoryBreakdown(userId, dateFilter) {
        return expense_model_1.Expense.aggregate([
            {
                $match: {
                    'splits.userId': userId,
                    createdAt: { $gte: dateFilter }
                }
            },
            { $unwind: '$splits' },
            { $match: { 'splits.userId': userId } },
            {
                $group: {
                    _id: '$category',
                    totalAmount: { $sum: '$splits.amountBase' },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    category: '$_id',
                    totalAmount: { $round: ['$totalAmount', 2] },
                    count: 1,
                    averagePerItem: { $round: [{ $divide: ['$totalAmount', '$count'] }, 2] }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);
    }
    /**
     * Spending trends over time
     */
    async getSpendingTrends(userId, timeframe) {
        const months = timeframe === 'year' ? 12 : timeframe === 'month' ? 4 : 1;
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        return expense_model_1.Expense.aggregate([
            {
                $match: {
                    'splits.userId': userId,
                    createdAt: { $gte: startDate }
                }
            },
            { $unwind: '$splits' },
            { $match: { 'splits.userId': userId } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalAmount: { $sum: '$splits.amountBase' },
                    expenseCount: { $sum: 1 },
                    uniqueCategories: { $addToSet: '$category' }
                }
            },
            {
                $project: {
                    period: {
                        $concat: [
                            { $toString: '$_id.year' },
                            '-',
                            { $toString: '$_id.month' }
                        ]
                    },
                    totalAmount: { $round: ['$totalAmount', 2] },
                    expenseCount: 1,
                    categoryCount: { $size: '$uniqueCategories' }
                }
            },
            { $sort: { period: 1 } }
        ]);
    }
    /**
     * Settlement efficiency
     */
    async getSettlementEfficiency(userId, dateFilter) {
        const settlements = await settlement_model_1.Settlement.aggregate([
            {
                $match: {
                    createdAt: { $gte: dateFilter }
                }
            },
            { $unwind: '$transactions' },
            {
                $match: {
                    $or: [
                        { 'transactions.from': userId },
                        { 'transactions.to': userId }
                    ]
                }
            },
            {
                $group: {
                    _id: '$transactions.status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$transactions.amountBase' }
                }
            }
        ]);
        const completed = settlements.find(s => s._id === 'confirmed') || { count: 0, totalAmount: 0 };
        const pending = settlements.find(s => s._id === 'pending' || s._id === 'initiated') || { count: 0, totalAmount: 0 };
        const total = settlements.reduce((sum, s) => sum + s.count, 0);
        return {
            totalSettlements: total,
            completedCount: completed.count,
            pendingCount: pending.count,
            completionRate: total > 0 ? Math.round((completed.count / total) * 100) : 0,
            totalSettledAmount: Math.round(completed.totalAmount * 100) / 100,
            totalPendingAmount: Math.round(pending.totalAmount * 100) / 100
        };
    }
    /**
     * Trip insights
     */
    async getTripInsights(userId, dateFilter) {
        const trips = await trip_model_1.Trip.find({
            'members.userId': userId,
            isArchived: false
        });
        const tripAnalytics = await Promise.all(trips.map(async (trip) => {
            const expenses = await expense_model_1.Expense.countDocuments({
                tripId: trip._id,
                'splits.userId': userId,
                createdAt: { $gte: dateFilter }
            });
            const totalAmount = await expense_model_1.Expense.aggregate([
                {
                    $match: {
                        tripId: trip._id,
                        'splits.userId': userId,
                        createdAt: { $gte: dateFilter }
                    }
                },
                { $unwind: '$splits' },
                { $match: { 'splits.userId': userId } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$splits.amountBase' }
                    }
                }
            ]);
            return {
                tripId: trip._id,
                title: trip.title,
                status: trip.status,
                expenseCount: expenses,
                totalSpent: totalAmount[0]?.total || 0,
                memberCount: trip.members.length,
                currency: trip.baseCurrency
            };
        }));
        return tripAnalytics;
    }
    /**
     * Trip overview
     */
    async getTripOverview(tripId, dateFilter) {
        return expense_model_1.Expense.aggregate([
            {
                $match: {
                    tripId,
                    createdAt: { $gte: dateFilter }
                }
            },
            {
                $group: {
                    _id: null,
                    totalExpenses: { $sum: 1 },
                    totalAmount: { $sum: '$amountBase' },
                    averageExpense: { $avg: '$amountBase' },
                    categories: { $addToSet: '$category' },
                    mostExpensiveCategory: { $max: '$amountBase' }
                }
            }
        ]);
    }
    /**
     * Member contributions
     */
    async getMemberContributions(tripId, dateFilter) {
        return expense_model_1.Expense.aggregate([
            {
                $match: {
                    tripId,
                    createdAt: { $gte: dateFilter }
                }
            },
            { $unwind: '$splits' },
            {
                $group: {
                    _id: '$splits.userId',
                    displayName: { $first: '$splits.displayName' },
                    totalConsumed: { $sum: '$splits.amountBase' },
                    expenseCount: { $sum: 1 },
                    categories: { $addToSet: '$category' }
                }
            },
            {
                $project: {
                    userId: '$_id',
                    displayName: 1,
                    totalConsumed: { $round: ['$totalConsumed', 2] },
                    expenseCount: 1,
                    categoryCount: { $size: '$categories' }
                }
            },
            { $sort: { totalConsumed: -1 } }
        ]);
    }
    /**
     * Trip category distribution
     */
    async getTripCategoryDistribution(tripId, dateFilter) {
        return expense_model_1.Expense.aggregate([
            {
                $match: {
                    tripId,
                    createdAt: { $gte: dateFilter }
                }
            },
            {
                $group: {
                    _id: '$category',
                    totalAmount: { $sum: '$amountBase' },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    category: '$_id',
                    totalAmount: { $round: ['$totalAmount', 2] },
                    count: 1
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);
    }
    /**
     * Expense timeline
     */
    async getExpenseTimeline(tripId, timeframe) {
        const months = timeframe === 'year' ? 12 : timeframe === 'month' ? 4 : 1;
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        return expense_model_1.Expense.aggregate([
            {
                $match: {
                    tripId,
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: timeframe === 'week' ? { $dayOfMonth: '$createdAt' } : null
                    },
                    totalAmount: { $sum: '$amountBase' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
    }
    /**
     * Trip settlement status
     */
    async getTripSettlementStatus(tripId) {
        return settlement_model_1.Settlement.aggregate([
            {
                $match: { tripId }
            },
            { $unwind: '$transactions' },
            {
                $group: {
                    _id: '$transactions.status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$transactions.amountBase' }
                }
            }
        ]);
    }
    /**
     * Calculate predictions using linear regression
     */
    calculatePredictions(historicalData) {
        const categoryMap = new Map();
        historicalData.forEach(record => {
            const category = record._id.category;
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category).push(record.totalAmount);
        });
        const predictions = {};
        categoryMap.forEach((values, category) => {
            if (values.length >= 3) {
                const n = values.length;
                const xMean = (n - 1) / 2;
                const yMean = values.reduce((a, b) => a + b, 0) / n;
                let numerator = 0;
                let denominator = 0;
                values.forEach((y, x) => {
                    numerator += (x - xMean) * (y - yMean);
                    denominator += (x - xMean) ** 2;
                });
                const slope = denominator !== 0 ? numerator / denominator : 0;
                const nextMonthPrediction = yMean + slope * n;
                predictions[category] = {
                    predictedAmount: Math.round(Math.max(0, nextMonthPrediction) * 100) / 100,
                    trend: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
                    confidence: Math.min(95, Math.round(Math.abs(slope) * 100 + 60))
                };
            }
        });
        return predictions;
    }
    /**
     * Get timeframe filter
     */
    getTimeframeFilter(timeframe) {
        const now = new Date();
        switch (timeframe) {
            case 'week':
                now.setDate(now.getDate() - 7);
                break;
            case 'month':
                now.setMonth(now.getMonth() - 1);
                break;
            case 'year':
                now.setFullYear(now.getFullYear() - 1);
                break;
        }
        return now;
    }
}
exports.AnalyticsService = AnalyticsService;
exports.analyticsService = new AnalyticsService();
//# sourceMappingURL=analytics.service.js.map
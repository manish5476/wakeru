"use strict";
// src/modules/analytics/analytics.aggregator.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsAggregator = void 0;
const expense_model_1 = require("../expense/expense.model");
const mongoose_1 = __importDefault(require("mongoose"));
class AnalyticsAggregator {
    /**
     * WAKERU EXCLUSIVE: Consumption vs Payment Analytics
     * Shows users their actual spending patterns, not just who paid
     */
    async getUserConsumptionVsPayment(userId, timeframe) {
        const dateFilter = this.getTimeframeFilter(timeframe);
        const pipeline = [
            {
                $match: {
                    'splits.userId': new mongoose_1.default.Types.ObjectId(userId),
                    createdAt: dateFilter,
                    isDeleted: false
                }
            },
            {
                $facet: {
                    // What user consumed (their share of items)
                    consumption: [
                        { $unwind: '$splits' },
                        { $match: { 'splits.userId': new mongoose_1.default.Types.ObjectId(userId) } },
                        { $unwind: '$splits.items' },
                        {
                            $group: {
                                _id: '$splits.items.category',
                                totalConsumed: {
                                    $sum: { $toDouble: '$splits.items.amount' }
                                },
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    // What user paid for
                    payments: [
                        { $match: { paidBy: new mongoose_1.default.Types.ObjectId(userId) } },
                        {
                            $group: {
                                _id: '$category',
                                totalPaid: { $sum: { $toDouble: '$splits.finalAmount' } },
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    // Overall stats
                    summary: [
                        { $unwind: '$splits' },
                        { $match: { 'splits.userId': new mongoose_1.default.Types.ObjectId(userId) } },
                        {
                            $group: {
                                _id: null,
                                totalConsumed: { $sum: { $toDouble: '$splits.finalAmount' } },
                                totalItems: { $sum: { $size: '$splits.items' } },
                                averagePerExpense: { $avg: { $toDouble: '$splits.finalAmount' } },
                                expenseCount: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ];
        const [result] = await expense_model_1.Expense.aggregate(pipeline);
        return {
            consumptionBreakdown: result.consumption,
            paymentBreakdown: result.payments,
            summary: result.summary[0] || {},
            // WAKERU INSIGHT: Discrepancy between consumption and payment
            analysis: this.generateBehavioralInsights(result.consumption, result.payments)
        };
    }
    generateBehavioralInsights(consumption, payments) {
        const insights = [];
        const consumptionMap = new Map(consumption.map(c => [c._id, c.totalConsumed]));
        const paymentMap = new Map(payments.map(p => [p._id, p.totalPaid]));
        // Find categories where user pays more than they consume
        for (const [category, totalPaid] of paymentMap) {
            const consumed = consumptionMap.get(category) || 0;
            if (totalPaid > consumed * 1.2) {
                insights.push(`You're paying ${((totalPaid / consumed - 1) * 100).toFixed(0)}% more than you consume in ${category}`);
            }
        }
        // Find categories where user is a net beneficiary
        for (const [category, totalConsumed] of consumptionMap) {
            const paid = paymentMap.get(category) || 0;
            if (totalConsumed > paid * 1.2) {
                insights.push(`You consume ${((totalConsumed / paid - 1) * 100).toFixed(0)}% more than you pay in ${category}`);
            }
        }
        return insights;
    }
    /**
     * PREDICTIVE ANALYTICS: Forecast future expenses
     */
    async getPredictiveAnalytics(userId, groupId) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const historicalData = await expense_model_1.Expense.aggregate([
            {
                $match: {
                    groupId: new mongoose_1.default.Types.ObjectId(groupId),
                    'splits.userId': new mongoose_1.default.Types.ObjectId(userId),
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
                    totalAmount: { $sum: { $toDouble: '$splits.finalAmount' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        // Simple linear regression for prediction
        return this.calculatePredictions(historicalData);
    }
    calculatePredictions(historicalData) {
        // Group by category and calculate trend
        const categoryTrends = new Map();
        historicalData.forEach(record => {
            const category = record._id.category;
            if (!categoryTrends.has(category)) {
                categoryTrends.set(category, []);
            }
            categoryTrends.get(category).push(record.totalAmount);
        });
        const predictions = {};
        categoryTrends.forEach((values, category) => {
            if (values.length >= 3) {
                // Simple linear regression
                const n = values.length;
                const xMean = (n - 1) / 2;
                const yMean = values.reduce((a, b) => a + b, 0) / n;
                let numerator = 0;
                let denominator = 0;
                values.forEach((y, x) => {
                    numerator += (x - xMean) * (y - yMean);
                    denominator += (x - xMean) ** 2;
                });
                const slope = numerator / denominator;
                const nextMonthPrediction = yMean + slope * n;
                predictions[category] = {
                    predictedAmount: Math.max(0, nextMonthPrediction),
                    trend: slope > 0 ? 'increasing' : 'decreasing',
                    confidence: Math.min(100, Math.abs(slope) * 100 + 60)
                };
            }
        });
        return predictions;
    }
    getTimeframeFilter(timeframe) {
        const now = new Date();
        if (timeframe === 'month') {
            return { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
        }
        return { $gte: new Date(now.getFullYear(), 0, 1) };
    }
}
exports.AnalyticsAggregator = AnalyticsAggregator;
//# sourceMappingURL=analytics.aggregator.js.map
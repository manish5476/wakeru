// src/modules/analytics/analytics.aggregator.ts

import { Expense } from '../expense/expense.model';
import mongoose from 'mongoose';

export class AnalyticsAggregator {
  /**
   * WAKERU EXCLUSIVE: Consumption vs Payment Analytics
   * Shows users their actual spending patterns, not just who paid
   */
  async getUserConsumptionVsPayment(userId: string, timeframe: 'month' | 'year') {
    const dateFilter = this.getTimeframeFilter(timeframe);

    const pipeline = [
      {
        $match: {
          'splits.userId': new mongoose.Types.ObjectId(userId),
          createdAt: dateFilter,
          isDeleted: false
        }
      },
      {
        $facet: {
          // What user consumed (their share of items)
          consumption: [
            { $unwind: '$splits' },
            { $match: { 'splits.userId': new mongoose.Types.ObjectId(userId) } },
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
            { $match: { paidBy: new mongoose.Types.ObjectId(userId) } },
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
            { $match: { 'splits.userId': new mongoose.Types.ObjectId(userId) } },
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

    const [result] = await Expense.aggregate(pipeline);

    return {
      consumptionBreakdown: result.consumption,
      paymentBreakdown: result.payments,
      summary: result.summary[0] || {},
      // WAKERU INSIGHT: Discrepancy between consumption and payment
      analysis: this.generateBehavioralInsights(result.consumption, result.payments)
    };
  }

  private generateBehavioralInsights(consumption: any[], payments: any[]) {
    const insights: string[] = [];
    const consumptionMap = new Map(
      consumption.map(c => [c._id, c.totalConsumed])
    );
    const paymentMap = new Map(
      payments.map(p => [p._id, p.totalPaid])
    );

    // Find categories where user pays more than they consume
    for (const [category, totalPaid] of paymentMap) {
      const consumed = consumptionMap.get(category) || 0;
      if (totalPaid > consumed * 1.2) {
        insights.push(
          `You're paying ${((totalPaid/consumed - 1) * 100).toFixed(0)}% more than you consume in ${category}`
        );
      }
    }

    // Find categories where user is a net beneficiary
    for (const [category, totalConsumed] of consumptionMap) {
      const paid = paymentMap.get(category) || 0;
      if (totalConsumed > paid * 1.2) {
        insights.push(
          `You consume ${((totalConsumed/paid - 1) * 100).toFixed(0)}% more than you pay in ${category}`
        );
      }
    }

    return insights;
  }

  /**
   * PREDICTIVE ANALYTICS: Forecast future expenses
   */
  async getPredictiveAnalytics(userId: string, groupId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const historicalData = await Expense.aggregate([
      {
        $match: {
          groupId: new mongoose.Types.ObjectId(groupId),
          'splits.userId': new mongoose.Types.ObjectId(userId),
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

  private calculatePredictions(historicalData: any[]) {
    // Group by category and calculate trend
    const categoryTrends = new Map<string, number[]>();
    
    historicalData.forEach(record => {
      const category = record._id.category;
      if (!categoryTrends.has(category)) {
        categoryTrends.set(category, []);
      }
      categoryTrends.get(category)!.push(record.totalAmount);
    });

    const predictions: any = {};
    
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

  private getTimeframeFilter(timeframe: 'month' | 'year') {
    const now = new Date();
    if (timeframe === 'month') {
      return { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
    return { $gte: new Date(now.getFullYear(), 0, 1) };
  }
}
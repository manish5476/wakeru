import { Expense } from '../expense/expense.model';
import { Group } from '../group/group.model';
import { Settlement } from '../settlement/settlement.model';
import { Types } from 'mongoose';
import { NotFoundError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import { redisClient } from '../../config/redis';
import Decimal from 'decimal.js';

export class AnalyticsService {
  /**
   * Get comprehensive user analytics
   */
  async getUserAnalytics(userId: string, timeframe: 'week' | 'month' | 'year' = 'month'): Promise<any> {
    const dateFilter = this.getTimeframeFilter(timeframe);

    const cacheKey = `analytics:user:${userId}:${timeframe}`;
    const cached = await redisClient.get(cacheKey);
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
    
    // Get group insights
    const groupInsights = await this.getGroupInsights(userId, dateFilter);

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
      groupInsights,
      generatedAt: new Date().toISOString()
    };

    // Cache for 2 hours
    await redisClient.set(cacheKey, JSON.stringify(analytics), 7200);

    return analytics;
  }

  /**
   * Get group analytics
   */
  async getGroupAnalytics(groupId: string, userId: string, timeframe: 'week' | 'month' | 'year' = 'month'): Promise<any> {
    // Verify group membership
    const group = await Group.findOne({
      groupId,
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new NotFoundError('Group not found or you are not a member');
    }

    const dateFilter = this.getTimeframeFilter(timeframe);

    const cacheKey = `analytics:group:${groupId}:${timeframe}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get group spending overview
    const overview = await this.getGroupOverview(group._id, dateFilter);
    
    // Get member contributions
    const memberContributions = await this.getMemberContributions(group._id, dateFilter);
    
    // Get category distribution
    const categoryDistribution = await this.getGroupCategoryDistribution(group._id, dateFilter);
    
    // Get expense timeline
    const expenseTimeline = await this.getExpenseTimeline(group._id, timeframe);
    
    // Get settlement status
    const settlementStatus = await this.getGroupSettlementStatus(group._id);

    const analytics = {
      timeframe,
      overview,
      memberContributions,
      categoryDistribution,
      expenseTimeline,
      settlementStatus,
      groupCurrency: group.settings.defaultCurrency,
      generatedAt: new Date().toISOString()
    };

    // Cache for 1 hour
    await redisClient.set(cacheKey, JSON.stringify(analytics), 3600);

    return analytics;
  }

  /**
   * Get predictive analytics
   */
  async getPredictiveAnalytics(userId: string, groupId: string): Promise<any> {
    const group = await Group.findOne({
      groupId,
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const expenses = await Expense.aggregate([
      {
        $match: {
          groupId: group._id,
          'splits.userId': new Types.ObjectId(userId),
          'metadata.isDeleted': false,
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
          totalAmount: { $sum: { $toDouble: '$totalAmount' } },
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
      currency: group.settings.defaultCurrency,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Consumption vs Payment analysis (WAKERU EXCLUSIVE)
   */
  private async getConsumptionVsPayment(userId: string, dateFilter: Date): Promise<any> {
    const pipeline = [
      {
        $match: {
          'splits.userId': new Types.ObjectId(userId),
          'metadata.isDeleted': false,
          createdAt: { $gte: dateFilter }
        }
      },
      {
        $facet: {
          consumption: [
            { $unwind: '$splits' },
            { $match: { 'splits.userId': new Types.ObjectId(userId) } },
            { $unwind: '$splits.items' },
            {
              $group: {
                _id: null,
                totalConsumed: { 
                  $sum: { $toDouble: '$splits.items.amount' } 
                },
                categories: { $addToSet: '$splits.items.category' }
              }
            }
          ],
          payments: [
            { $match: { paidBy: new Types.ObjectId(userId) } },
            {
              $group: {
                _id: null,
                totalPaid: { $sum: { $toDouble: '$totalAmount' } },
                count: { $sum: 1 }
              }
            }
          ],
          stats: [
            { $unwind: '$splits' },
            { $match: { 'splits.userId': new Types.ObjectId(userId) } },
            {
              $group: {
                _id: null,
                totalExpenses: { $sum: 1 },
                averageAmount: { $avg: { $toDouble: '$splits.finalAmount' } },
                maxAmount: { $max: { $toDouble: '$splits.finalAmount' } },
                minAmount: { $min: { $toDouble: '$splits.finalAmount' } }
              }
            }
          ]
        }
      }
    ];

    const [result] = await Expense.aggregate(pipeline);

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
  private async getCategoryBreakdown(userId: string, dateFilter: Date): Promise<any> {
    return Expense.aggregate([
      {
        $match: {
          'splits.userId': new Types.ObjectId(userId),
          'metadata.isDeleted': false,
          createdAt: { $gte: dateFilter }
        }
      },
      { $unwind: '$splits' },
      { $match: { 'splits.userId': new Types.ObjectId(userId) } },
      { $unwind: '$splits.items' },
      {
        $group: {
          _id: '$splits.items.category',
          totalAmount: { $sum: { $toDouble: '$splits.items.amount' } },
          count: { $sum: 1 },
          percentage: { $sum: 100 }
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
  private async getSpendingTrends(userId: string, timeframe: string): Promise<any> {
    const months = timeframe === 'year' ? 12 : timeframe === 'month' ? 4 : 1;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return Expense.aggregate([
      {
        $match: {
          'splits.userId': new Types.ObjectId(userId),
          'metadata.isDeleted': false,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalAmount: { $sum: { $toDouble: '$totalAmount' } },
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
  private async getSettlementEfficiency(userId: string, dateFilter: Date): Promise<any> {
    const settlements = await Settlement.aggregate([
      {
        $match: {
          $or: [
            { fromUser: new Types.ObjectId(userId) },
            { toUser: new Types.ObjectId(userId) }
          ],
          createdAt: { $gte: dateFilter }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } }
        }
      }
    ]);

    const completed = settlements.find(s => s._id === 'COMPLETED') || { count: 0, totalAmount: 0 };
    const pending = settlements.find(s => s._id === 'PENDING') || { count: 0, totalAmount: 0 };
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
   * Group insights
   */
  private async getGroupInsights(userId: string, dateFilter: Date): Promise<any> {
    const groups = await Group.find({
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED'
    });

    const groupAnalytics = await Promise.all(
      groups.map(async (group) => {
        const expenses = await Expense.countDocuments({
          groupId: group._id,
          'splits.userId': new Types.ObjectId(userId),
          'metadata.isDeleted': false,
          createdAt: { $gte: dateFilter }
        });

        const totalAmount = await Expense.aggregate([
          {
            $match: {
              groupId: group._id,
              'splits.userId': new Types.ObjectId(userId),
              'metadata.isDeleted': false,
              createdAt: { $gte: dateFilter }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: '$totalAmount' } }
            }
          }
        ]);

        return {
          groupId: group.groupId,
          name: group.name,
          type: group.type,
          expenseCount: expenses,
          totalSpent: totalAmount[0]?.total || 0,
          memberCount: group.members.length,
          currency: group.settings.defaultCurrency
        };
      })
    );

    return groupAnalytics;
  }

  /**
   * Group overview
   */
  private async getGroupOverview(groupId: Types.ObjectId, dateFilter: Date): Promise<any> {
    return Expense.aggregate([
      {
        $match: {
          groupId,
          'metadata.isDeleted': false,
          createdAt: { $gte: dateFilter }
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$totalAmount' } },
          averageExpense: { $avg: { $toDouble: '$totalAmount' } },
          categories: { $addToSet: '$category' },
          mostExpensiveCategory: { $max: { $toDouble: '$totalAmount' } }
        }
      }
    ]);
  }

  /**
   * Member contributions
   */
  private async getMemberContributions(groupId: Types.ObjectId, dateFilter: Date): Promise<any> {
    return Expense.aggregate([
      {
        $match: {
          groupId,
          'metadata.isDeleted': false,
          createdAt: { $gte: dateFilter }
        }
      },
      { $unwind: '$splits' },
      {
        $group: {
          _id: '$splits.userId',
          totalConsumed: { $sum: { $toDouble: '$splits.finalAmount' } },
          expenseCount: { $sum: 1 },
          categories: { $addToSet: '$category' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          totalConsumed: { $round: ['$totalConsumed', 2] },
          expenseCount: 1,
          categoryCount: { $size: '$categories' }
        }
      },
      { $sort: { totalConsumed: -1 } }
    ]);
  }

  /**
   * Group category distribution
   */
  private async getGroupCategoryDistribution(groupId: Types.ObjectId, dateFilter: Date): Promise<any> {
    return Expense.aggregate([
      {
        $match: {
          groupId,
          'metadata.isDeleted': false,
          createdAt: { $gte: dateFilter }
        }
      },
      { $unwind: '$splits' },
      { $unwind: '$splits.items' },
      {
        $group: {
          _id: '$splits.items.category',
          totalAmount: { $sum: { $toDouble: '$splits.items.amount' } },
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
  private async getExpenseTimeline(groupId: Types.ObjectId, timeframe: string): Promise<any> {
    const months = timeframe === 'year' ? 12 : timeframe === 'month' ? 4 : 1;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return Expense.aggregate([
      {
        $match: {
          groupId,
          'metadata.isDeleted': false,
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
          totalAmount: { $sum: { $toDouble: '$totalAmount' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
  }

  /**
   * Group settlement status
   */
  private async getGroupSettlementStatus(groupId: Types.ObjectId): Promise<any> {
    return Settlement.aggregate([
      {
        $match: { groupId }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } }
        }
      }
    ]);
  }

  /**
   * Calculate predictions using linear regression
   */
  private calculatePredictions(historicalData: any[]): any {
    const categoryMap = new Map<string, number[]>();
    
    historicalData.forEach(record => {
      const category = record._id.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(record.totalAmount);
    });

    const predictions: any = {};
    
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
  private getTimeframeFilter(timeframe: 'week' | 'month' | 'year'): Date {
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

export const analyticsService = new AnalyticsService();
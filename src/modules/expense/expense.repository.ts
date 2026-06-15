import { Expense, IExpenseDocument } from './expense.model';
import { Types } from 'mongoose';
import { CreateExpenseDTO } from '../../shared/types/expense.types';

export class ExpenseRepository {
  async createExpense(expenseData: Partial<IExpenseDocument>): Promise<IExpenseDocument> {
    const expense = new Expense(expenseData);
    return expense.save();
  }

  async findById(expenseId: string): Promise<IExpenseDocument | null> {
    return Expense.findOne({ 
      expenseId, 
      'metadata.isDeleted': false 
    }).populate('splits.userId', 'userId email firstName lastName displayName profilePicture')
      .populate('paidBy', 'userId email firstName lastName displayName');
  }

  async findByIdWithDeleted(expenseId: string): Promise<IExpenseDocument | null> {
    return Expense.findOne({ expenseId });
  }

  async findByGroupId(groupId: string, options: {
    page?: number;
    limit?: number;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ expenses: IExpenseDocument[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      category,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const query: any = {
      groupId: new Types.ObjectId(groupId),
      'metadata.isDeleted': false
    };

    if (category) {
      query.category = category;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('splits.userId', 'userId email firstName lastName displayName profilePicture')
        .populate('paidBy', 'userId email firstName lastName displayName')
        .populate('metadata.createdBy', 'userId email firstName lastName displayName')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit),
      Expense.countDocuments(query)
    ]);

    return { expenses, total };
  }

  async findByUserId(userId: string, options: {
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<{ expenses: IExpenseDocument[]; total: number }> {
    const { page = 1, limit = 20, startDate, endDate } = options;

    const query: any = {
      'splits.userId': new Types.ObjectId(userId),
      'metadata.isDeleted': false
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('groupId', 'name type avatar')
        .populate('splits.userId', 'userId email firstName lastName displayName profilePicture')
        .populate('paidBy', 'userId email firstName lastName displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Expense.countDocuments(query)
    ]);

    return { expenses, total };
  }

  async softDelete(expenseId: string, deletedBy: string): Promise<IExpenseDocument | null> {
    return Expense.findOneAndUpdate(
      { expenseId },
      {
        $set: {
          'metadata.isDeleted': true,
          'metadata.deletedBy': new Types.ObjectId(deletedBy),
          'metadata.deletedAt': new Date()
        }
      },
      { new: true }
    );
  }

  async updateSettlementStatus(
    expenseId: string, 
    userId: string, 
    status: 'PENDING' | 'SETTLED' | 'PARTIAL'
  ): Promise<void> {
    await Expense.findOneAndUpdate(
      { 
        expenseId, 
        'splits.userId': new Types.ObjectId(userId) 
      },
      { 
        $set: { 'splits.$.settlementStatus': status } 
      }
    );
  }

  async getGroupExpenseStats(groupId: string): Promise<any> {
    return Expense.aggregate([
      {
        $match: {
          groupId: new Types.ObjectId(groupId),
          'metadata.isDeleted': false
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$totalAmount' } },
          averageAmount: { $avg: { $toDouble: '$totalAmount' } },
          maxAmount: { $max: { $toDouble: '$totalAmount' } },
          minAmount: { $min: { $toDouble: '$totalAmount' } },
          lastExpenseDate: { $max: '$createdAt' },
          categories: { $addToSet: '$category' }
        }
      }
    ]);
  }

  async getCategoryAnalytics(userId: string, groupId: string, startDate: Date, endDate: Date): Promise<any> {
    return Expense.aggregate([
      {
        $match: {
          groupId: new Types.ObjectId(groupId),
          'splits.userId': new Types.ObjectId(userId),
          'metadata.isDeleted': false,
          createdAt: { $gte: startDate, $lte: endDate }
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
          expenses: { $addToSet: '$_id' }
        }
      },
      {
        $project: {
          category: '$_id',
          totalAmount: 1,
          count: 1,
          uniqueExpenses: { $size: '$expenses' },
          averagePerExpense: { $divide: ['$totalAmount', '$count'] }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);
  }

  async findByDateRange(startDate: Date, endDate: Date, groupId?: string): Promise<IExpenseDocument[]> {
    const query: any = {
      'metadata.isDeleted': false,
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (groupId) {
      query.groupId = new Types.ObjectId(groupId);
    }

    return Expense.find(query)
      .populate('splits.userId', 'userId email firstName lastName')
      .sort({ createdAt: -1 });
  }

  async getTotalExpenseAmountForPeriod(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await Expense.aggregate([
      {
        $match: {
          'splits.userId': new Types.ObjectId(userId),
          'metadata.isDeleted': false,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$splits' },
      { $match: { 'splits.userId': new Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: '$splits.finalAmount' } }
        }
      }
    ]);

    return result.length > 0 ? result[0].total : 0;
  }
}

export const expenseRepository = new ExpenseRepository();
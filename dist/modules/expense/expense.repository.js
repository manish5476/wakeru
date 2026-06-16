"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseRepository = exports.ExpenseRepository = void 0;
const expense_model_1 = require("./expense.model");
const mongoose_1 = require("mongoose");
class ExpenseRepository {
    async createExpense(expenseData) {
        const expense = new expense_model_1.Expense(expenseData);
        return expense.save();
    }
    async findById(expenseId) {
        return expense_model_1.Expense.findOne({
            expenseId,
            'metadata.isDeleted': false
        }).populate('splits.userId', 'userId email firstName lastName displayName profilePicture')
            .populate('paidBy', 'userId email firstName lastName displayName');
    }
    async findByIdWithDeleted(expenseId) {
        return expense_model_1.Expense.findOne({ expenseId });
    }
    async findByGroupId(groupId, options = {}) {
        const { page = 1, limit = 20, category, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const query = {
            groupId: new mongoose_1.Types.ObjectId(groupId),
            'metadata.isDeleted': false
        };
        if (category) {
            query.category = category;
        }
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate)
                query.createdAt.$gte = startDate;
            if (endDate)
                query.createdAt.$lte = endDate;
        }
        const skip = (page - 1) * limit;
        const [expenses, total] = await Promise.all([
            expense_model_1.Expense.find(query)
                .populate('splits.userId', 'userId email firstName lastName displayName profilePicture')
                .populate('paidBy', 'userId email firstName lastName displayName')
                .populate('metadata.createdBy', 'userId email firstName lastName displayName')
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .skip(skip)
                .limit(limit),
            expense_model_1.Expense.countDocuments(query)
        ]);
        return { expenses, total };
    }
    async findByUserId(userId, options = {}) {
        const { page = 1, limit = 20, startDate, endDate } = options;
        const query = {
            'splits.userId': new mongoose_1.Types.ObjectId(userId),
            'metadata.isDeleted': false
        };
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate)
                query.createdAt.$gte = startDate;
            if (endDate)
                query.createdAt.$lte = endDate;
        }
        const skip = (page - 1) * limit;
        const [expenses, total] = await Promise.all([
            expense_model_1.Expense.find(query)
                .populate('groupId', 'name type avatar')
                .populate('splits.userId', 'userId email firstName lastName displayName profilePicture')
                .populate('paidBy', 'userId email firstName lastName displayName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            expense_model_1.Expense.countDocuments(query)
        ]);
        return { expenses, total };
    }
    async softDelete(expenseId, deletedBy) {
        return expense_model_1.Expense.findOneAndUpdate({ expenseId }, {
            $set: {
                'metadata.isDeleted': true,
                'metadata.deletedBy': new mongoose_1.Types.ObjectId(deletedBy),
                'metadata.deletedAt': new Date()
            }
        }, { new: true });
    }
    async updateSettlementStatus(expenseId, userId, status) {
        await expense_model_1.Expense.findOneAndUpdate({
            expenseId,
            'splits.userId': new mongoose_1.Types.ObjectId(userId)
        }, {
            $set: { 'splits.$.settlementStatus': status }
        });
    }
    async getGroupExpenseStats(groupId) {
        return expense_model_1.Expense.aggregate([
            {
                $match: {
                    groupId: new mongoose_1.Types.ObjectId(groupId),
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
    async getCategoryAnalytics(userId, groupId, startDate, endDate) {
        return expense_model_1.Expense.aggregate([
            {
                $match: {
                    groupId: new mongoose_1.Types.ObjectId(groupId),
                    'splits.userId': new mongoose_1.Types.ObjectId(userId),
                    'metadata.isDeleted': false,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $unwind: '$splits' },
            { $match: { 'splits.userId': new mongoose_1.Types.ObjectId(userId) } },
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
    async findByDateRange(startDate, endDate, groupId) {
        const query = {
            'metadata.isDeleted': false,
            createdAt: { $gte: startDate, $lte: endDate }
        };
        if (groupId) {
            query.groupId = new mongoose_1.Types.ObjectId(groupId);
        }
        return expense_model_1.Expense.find(query)
            .populate('splits.userId', 'userId email firstName lastName')
            .sort({ createdAt: -1 });
    }
    async getTotalExpenseAmountForPeriod(userId, startDate, endDate) {
        const result = await expense_model_1.Expense.aggregate([
            {
                $match: {
                    'splits.userId': new mongoose_1.Types.ObjectId(userId),
                    'metadata.isDeleted': false,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $unwind: '$splits' },
            { $match: { 'splits.userId': new mongoose_1.Types.ObjectId(userId) } },
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
exports.ExpenseRepository = ExpenseRepository;
exports.expenseRepository = new ExpenseRepository();
//# sourceMappingURL=expense.repository.js.map
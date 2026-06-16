"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseService = exports.ExpenseService = void 0;
const expense_repository_1 = require("./expense.repository");
const expense_calculator_1 = require("./expense.calculator");
const expense_model_1 = require("./expense.model");
const AppError_1 = require("../../shared/errors/AppError");
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
const mongoose_1 = require("mongoose");
const group_model_1 = require("../group/group.model");
const user_model_1 = require("../user/user.model");
const crypto_1 = __importDefault(require("crypto"));
class ExpenseService {
    /**
     * Create a new expense with proportional splitting
     */
    async createExpense(expenseData, createdBy) {
        // Verify group exists and user is member
        const group = await group_model_1.Group.findOne({
            groupId: expenseData.groupId,
            'members.userId': new mongoose_1.Types.ObjectId(createdBy),
            'members.invitationStatus': 'ACCEPTED'
        });
        if (!group) {
            throw new AppError_1.NotFoundError('Group not found or you are not a member');
        }
        // Idempotency Check
        if (expenseData.idempotencyKey) {
            const existingExpense = await expense_model_1.Expense.findOne({ idempotencyKey: expenseData.idempotencyKey });
            if (existingExpense) {
                logger_1.logger.info(`Idempotent request processed. Returning existing expense for key: ${expenseData.idempotencyKey}`);
                return existingExpense;
            }
        }
        // Validate expense data
        const validation = expense_calculator_1.expenseCalculator.validateExpense(expenseData.lineItems, expenseData.taxes || []);
        if (!validation.isValid) {
            throw new AppError_1.BadRequestError(validation.errors.join('; '));
        }
        // Verify all consumers are group members
        const memberIds = group.members
            .filter((m) => m.invitationStatus === 'ACCEPTED')
            .map((m) => m.userId.toString());
        expenseData.lineItems.forEach(item => {
            item.consumers.forEach(consumer => {
                if (!memberIds.includes(consumer.userId)) {
                    throw new AppError_1.BadRequestError(`User ${consumer.userId} is not a member of this group`);
                }
            });
        });
        // Use client-provided key or generate a new one
        const idempotencyKey = expenseData.idempotencyKey || crypto_1.default.randomUUID();
        // Calculate proportional splits
        const { splits, analytics, totals } = expense_calculator_1.expenseCalculator.calculateProportionalSplit(expenseData.lineItems, expenseData.taxes || [], expenseData.discounts || [], expenseData.paidBy, expenseData.currency);
        // Create expense document
        const expenseDoc = {
            expenseId: crypto_1.default.randomUUID(),
            groupId: group._id,
            description: expenseData.description,
            category: expenseData.category,
            currency: expenseData.currency,
            lineItems: expenseData.lineItems.map(item => ({
                itemId: crypto_1.default.randomUUID(),
                name: item.name,
                category: item.category,
                basePrice: mongoose_1.Types.Decimal128.fromString(item.basePrice.toFixed(2)),
                quantity: item.quantity,
                consumers: item.consumers.map(c => ({
                    userId: new mongoose_1.Types.ObjectId(c.userId),
                    consumptionPercentage: c.consumptionPercentage,
                    quantity: c.quantity,
                    notes: c.notes
                }))
            })),
            taxes: expenseData.taxes?.map(tax => ({
                name: tax.name,
                percentage: tax.percentage,
                amount: mongoose_1.Types.Decimal128.fromString('0'), // Will be calculated
                applicableTo: tax.applicableTo,
                applicableItems: tax.applicableItems,
                taxCode: tax.taxCode
            })),
            discounts: expenseData.discounts?.map(discount => ({
                type: discount.type,
                value: mongoose_1.Types.Decimal128.fromString(discount.value.toFixed(2)),
                code: discount.code,
                description: discount.description,
                applicableTo: discount.applicableTo,
                applicableItems: discount.applicableItems
            })),
            splits,
            paidBy: new mongoose_1.Types.ObjectId(expenseData.paidBy),
            paymentMethod: expenseData.paymentMethod,
            paymentDate: expenseData.paymentDate || new Date(),
            totalAmount: totals.totalAmount,
            subTotal: totals.subTotal,
            taxTotal: totals.taxTotal,
            discountTotal: totals.discountTotal,
            analytics,
            metadata: {
                createdBy: new mongoose_1.Types.ObjectId(createdBy),
                isDeleted: false,
                version: 1
            },
            idempotencyKey
        };
        const expense = await expense_repository_1.expenseRepository.createExpense(expenseDoc);
        // Update group financial summary (async)
        this.updateGroupFinancials(group.groupId).catch(err => logger_1.logger.error('Failed to update group financials:', err));
        // Update user stats (async)
        this.updateUserStats(expense.splits.map(s => s.userId.toString())).catch(err => logger_1.logger.error('Failed to update user stats:', err));
        // Invalidate caches
        await this.invalidateRelatedCaches(group.groupId, expense.splits);
        logger_1.logger.info(`Expense created: ${expense.expenseId} in group ${group.groupId}`);
        return expense;
    }
    /**
     * Get expense by ID
     */
    async getExpenseById(expenseId, userId) {
        const expense = await expense_repository_1.expenseRepository.findById(expenseId);
        if (!expense) {
            throw new AppError_1.NotFoundError('Expense');
        }
        // Verify user is part of this expense's group
        const group = await group_model_1.Group.findOne({
            _id: expense.groupId,
            'members.userId': new mongoose_1.Types.ObjectId(userId),
            'members.invitationStatus': 'ACCEPTED'
        });
        if (!group) {
            throw new AppError_1.ForbiddenError('You do not have access to this expense');
        }
        return expense;
    }
    /**
     * Get expenses for a group
     */
    async getGroupExpenses(groupId, userId, options = {}) {
        // Verify membership
        const group = await group_model_1.Group.findOne({
            groupId,
            'members.userId': new mongoose_1.Types.ObjectId(userId),
            'members.invitationStatus': 'ACCEPTED'
        });
        if (!group) {
            throw new AppError_1.ForbiddenError('You are not a member of this group');
        }
        return expense_repository_1.expenseRepository.findByGroupId(group._id.toString(), options);
    }
    /**
     * Get user's expenses
     */
    async getUserExpenses(userId, options = {}) {
        return expense_repository_1.expenseRepository.findByUserId(userId, options);
    }
    /**
     * Update expense
     */
    async updateExpense(expenseId, userId, updateData) {
        const expense = await expense_repository_1.expenseRepository.findById(expenseId);
        if (!expense) {
            throw new AppError_1.NotFoundError('Expense');
        }
        // Check if user is the creator or group admin
        const group = await group_model_1.Group.findOne({
            _id: expense.groupId,
            'members.userId': new mongoose_1.Types.ObjectId(userId),
            'members.invitationStatus': 'ACCEPTED'
        });
        if (!group) {
            throw new AppError_1.ForbiddenError('You do not have permission to update this expense');
        }
        const isAdmin = group.members.find((m) => m.userId.toString() === userId && m.role === 'ADMIN');
        if (expense.metadata.createdBy.toString() !== userId && !isAdmin) {
            throw new AppError_1.ForbiddenError('Only the expense creator or group admin can update this expense');
        }
        // Recalculate if line items changed
        if (updateData.lineItems || updateData.taxes || updateData.discounts) {
            const { splits, analytics, totals } = expense_calculator_1.expenseCalculator.calculateProportionalSplit((updateData.lineItems || expense.lineItems), (updateData.taxes || expense.taxes), (updateData.discounts || expense.discounts), expense.paidBy.toString(), expense.currency);
            expense.splits = splits;
            expense.analytics = analytics;
            expense.totalAmount = totals.totalAmount;
            expense.subTotal = totals.subTotal;
            expense.taxTotal = totals.taxTotal;
            expense.discountTotal = totals.discountTotal;
        }
        if (updateData.description)
            expense.description = updateData.description;
        if (updateData.category)
            expense.category = updateData.category;
        expense.metadata.version += 1;
        expense.metadata.updatedBy = new mongoose_1.Types.ObjectId(userId);
        await expense.save();
        // Invalidate caches
        await this.invalidateRelatedCaches(group.groupId, expense.splits);
        logger_1.logger.info(`Expense updated: ${expenseId}`);
        return expense;
    }
    /**
     * Delete expense (soft delete)
     */
    async deleteExpense(expenseId, userId) {
        const expense = await expense_repository_1.expenseRepository.findById(expenseId);
        if (!expense) {
            throw new AppError_1.NotFoundError('Expense');
        }
        // Check permissions
        const group = await group_model_1.Group.findOne({
            _id: expense.groupId,
            'members.userId': new mongoose_1.Types.ObjectId(userId)
        });
        if (!group) {
            throw new AppError_1.ForbiddenError('You do not have permission to delete this expense');
        }
        const isAdmin = group.members.find((m) => m.userId.toString() === userId && m.role === 'ADMIN');
        if (expense.metadata.createdBy.toString() !== userId && !isAdmin) {
            throw new AppError_1.ForbiddenError('Only the expense creator or group admin can delete this expense');
        }
        // Check if any splits are settled
        const hasSettledSplits = expense.splits.some(s => s.settlementStatus === 'SETTLED');
        if (hasSettledSplits) {
            throw new AppError_1.BadRequestError('Cannot delete expense with settled splits');
        }
        await expense_repository_1.expenseRepository.softDelete(expenseId, userId);
        // Reverse the financial impact
        await this.updateGroupFinancials(group.groupId);
        await this.invalidateRelatedCaches(group.groupId, expense.splits);
        logger_1.logger.info(`Expense deleted: ${expenseId}`);
    }
    /**
     * Update group financial summary
     */
    async updateGroupFinancials(groupId) {
        const stats = await expense_repository_1.expenseRepository.getGroupExpenseStats(groupId);
        if (stats.length > 0) {
            const stat = stats[0];
            await group_model_1.Group.findOneAndUpdate({ groupId }, {
                $set: {
                    'financialSummary.totalExpenses': stat.totalExpenses,
                    'financialSummary.totalPending': mongoose_1.Types.Decimal128.fromString(stat.totalAmount.toFixed(2)),
                    'financialSummary.averageExpenseAmount': mongoose_1.Types.Decimal128.fromString(stat.averageAmount.toFixed(2)),
                    'financialSummary.lastExpenseDate': stat.lastExpenseDate,
                    'financialSummary.expenseCount': stat.totalExpenses
                }
            });
        }
    }
    /**
     * Update user statistics
     */
    async updateUserStats(userIds) {
        for (const userId of userIds) {
            const totalExpenses = await expense_model_1.Expense.countDocuments({
                'splits.userId': new mongoose_1.Types.ObjectId(userId),
                'metadata.isDeleted': false
            });
            await user_model_1.UserModel.findOneAndUpdate({ _id: new mongoose_1.Types.ObjectId(userId) }, {
                $set: {
                    'stats.totalExpenses': totalExpenses,
                    'stats.lastActiveAt': new Date()
                }
            });
        }
    }
    /**
     * Invalidate related caches
     */
    async invalidateRelatedCaches(groupId, splits) {
        await redis_1.redisClient.delete(`group:${groupId}`);
        // Invalidate user caches
        const userIds = new Set();
        splits.forEach((split) => userIds.add(split.userId.toString()));
        for (const userId of userIds) {
            await redis_1.redisClient.delete(`user:${userId}:groups`);
            await redis_1.redisClient.delete(`user:${userId}:expenses`);
        }
    }
}
exports.ExpenseService = ExpenseService;
exports.expenseService = new ExpenseService();
//# sourceMappingURL=expense.service.js.map
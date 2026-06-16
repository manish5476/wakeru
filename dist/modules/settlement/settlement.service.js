"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementService = exports.SettlementService = void 0;
const settlement_model_1 = require("./settlement.model");
const debt_simplifier_1 = require("./debt.simplifier");
const expense_model_1 = require("../expense/expense.model");
const group_model_1 = require("../group/group.model");
const AppError_1 = require("../../shared/errors/AppError");
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
const mongoose_1 = require("mongoose");
const crypto_1 = __importDefault(require("crypto"));
const decimal_js_1 = __importDefault(require("decimal.js"));
class SettlementService {
    /**
     * Get simplified debts for a group
     */
    async getSimplifiedDebts(groupId, userId) {
        // Verify group membership
        const group = await group_model_1.Group.findOne({
            groupId,
            'members.userId': new mongoose_1.Types.ObjectId(userId),
            'members.invitationStatus': 'ACCEPTED'
        });
        if (!group) {
            throw new AppError_1.ForbiddenError('You are not a member of this group');
        }
        // Get all unsettled expenses
        const expenses = await expense_model_1.Expense.find({
            groupId: group._id,
            'metadata.isDeleted': false,
            'splits.settlementStatus': { $ne: 'SETTLED' }
        });
        // Collect all debts
        const debts = [];
        expenses.forEach(expense => {
            const payer = expense.paidBy.toString();
            expense.splits.forEach(split => {
                if (split.settlementStatus === 'SETTLED')
                    return;
                const consumer = split.userId.toString();
                // Only create debt if consumer is not the payer
                if (consumer !== payer) {
                    debts.push({
                        from: consumer,
                        to: payer,
                        amount: split.finalAmount,
                        groupId: groupId,
                        expenseId: expense.expenseId
                    });
                }
            });
        });
        // Simplify debts
        const simplified = debt_simplifier_1.debtSimplifier.simplifyDebts(debts);
        return {
            originalDebtCount: debts.length,
            simplifiedTransactionCount: simplified.length,
            savings: debts.length - simplified.length,
            transactions: simplified,
            currency: group.settings.defaultCurrency
        };
    }
    /**
     * Get debt summary for a user in a group
     */
    async getDebtSummary(groupId, userId) {
        const group = await group_model_1.Group.findOne({
            groupId,
            'members.userId': new mongoose_1.Types.ObjectId(userId),
            'members.invitationStatus': 'ACCEPTED'
        });
        if (!group) {
            throw new AppError_1.ForbiddenError('You are not a member of this group');
        }
        const expenses = await expense_model_1.Expense.find({
            groupId: group._id,
            'metadata.isDeleted': false,
            'splits.settlementStatus': { $ne: 'SETTLED' }
        });
        const debts = [];
        expenses.forEach(expense => {
            const payer = expense.paidBy.toString();
            expense.splits.forEach(split => {
                if (split.settlementStatus === 'SETTLED')
                    return;
                const consumer = split.userId.toString();
                if (consumer !== payer) {
                    debts.push({
                        from: consumer,
                        to: payer,
                        amount: split.finalAmount,
                        groupId: groupId,
                        expenseId: expense.expenseId
                    });
                }
            });
        });
        return debt_simplifier_1.debtSimplifier.getDebtSummary(userId, debts);
    }
    /**
     * Create a settlement
     */
    async createSettlement(groupId, fromUser, toUser, amount, paymentMethod, createdBy) {
        // Verify group membership
        const group = await group_model_1.Group.findOne({
            groupId,
            'members.userId': new mongoose_1.Types.ObjectId(fromUser),
            'members.invitationStatus': 'ACCEPTED'
        });
        if (!group) {
            throw new AppError_1.ForbiddenError('Invalid group or user');
        }
        // Verify both users are members
        const toMember = group.members.find((m) => m.userId.toString() === toUser && m.invitationStatus === 'ACCEPTED');
        if (!toMember) {
            throw new AppError_1.BadRequestError('Recipient is not a member of this group');
        }
        // Check for duplicate settlement
        const idempotencyKey = crypto_1.default.randomUUID();
        const existingSettlement = await settlement_model_1.Settlement.findOne({ idempotencyKey });
        if (existingSettlement) {
            throw new AppError_1.ConflictError('Duplicate settlement detected');
        }
        // Create settlement record
        const settlement = new settlement_model_1.Settlement({
            settlementId: crypto_1.default.randomUUID(),
            groupId: group._id,
            fromUser: new mongoose_1.Types.ObjectId(fromUser),
            toUser: new mongoose_1.Types.ObjectId(toUser),
            amount: mongoose_1.Types.Decimal128.fromString(amount.toFixed(2)),
            currency: group.settings.defaultCurrency,
            expenses: [],
            paymentMethod,
            status: 'PENDING',
            statusHistory: [{
                    status: 'PENDING',
                    timestamp: new Date(),
                    updatedBy: new mongoose_1.Types.ObjectId(createdBy),
                    remarks: 'Settlement created'
                }],
            createdBy: new mongoose_1.Types.ObjectId(createdBy),
            settlementDate: new Date(),
            idempotencyKey
        });
        await settlement.save();
        logger_1.logger.info(`Settlement created: ${settlement.settlementId}`);
        return settlement;
    }
    /**
     * Process payment for a settlement
     */
    async processPayment(settlementId, paymentDetails, userId) {
        const settlement = await settlement_model_1.Settlement.findOne({ settlementId });
        if (!settlement) {
            throw new AppError_1.NotFoundError('Settlement');
        }
        if (settlement.fromUser.toString() !== userId) {
            throw new AppError_1.ForbiddenError('Only the payer can process this settlement');
        }
        if (settlement.status !== 'PENDING') {
            throw new AppError_1.BadRequestError(`Settlement is already ${settlement.status}`);
        }
        // Update settlement status
        settlement.status = 'COMPLETED';
        settlement.completedAt = new Date();
        settlement.paymentDetails = {
            ...paymentDetails,
            paidAt: new Date()
        };
        settlement.statusHistory.push({
            status: 'COMPLETED',
            timestamp: new Date(),
            updatedBy: new mongoose_1.Types.ObjectId(userId),
            remarks: 'Payment processed'
        });
        await settlement.save();
        // Update group member balances
        await this.updateMemberBalances(settlement.groupId.toString(), settlement.fromUser.toString(), settlement.toUser.toString(), parseFloat(settlement.amount.toString()));
        // Update related expenses
        await this.updateRelatedExpenses(settlement.groupId.toString(), settlement.fromUser.toString(), settlement.toUser.toString(), parseFloat(settlement.amount.toString()));
        // Invalidate caches
        await redis_1.redisClient.delete(`group:${settlement.groupId}`);
        logger_1.logger.info(`Settlement completed: ${settlementId}`);
        return settlement;
    }
    /**
     * Cancel a settlement
     */
    async cancelSettlement(settlementId, userId) {
        const settlement = await settlement_model_1.Settlement.findOne({ settlementId });
        if (!settlement) {
            throw new AppError_1.NotFoundError('Settlement');
        }
        if (settlement.status === 'COMPLETED') {
            throw new AppError_1.BadRequestError('Cannot cancel a completed settlement');
        }
        settlement.status = 'CANCELLED';
        settlement.statusHistory.push({
            status: 'CANCELLED',
            timestamp: new Date(),
            updatedBy: new mongoose_1.Types.ObjectId(userId),
            remarks: 'Settlement cancelled'
        });
        await settlement.save();
        logger_1.logger.info(`Settlement cancelled: ${settlementId}`);
        return settlement;
    }
    /**
     * Get settlement history for a group
     */
    async getSettlementHistory(groupId, userId, options = {}) {
        const group = await group_model_1.Group.findOne({
            groupId,
            'members.userId': new mongoose_1.Types.ObjectId(userId),
            'members.invitationStatus': 'ACCEPTED'
        });
        if (!group) {
            throw new AppError_1.ForbiddenError('You are not a member of this group');
        }
        const { page = 1, limit = 20 } = options;
        const skip = (page - 1) * limit;
        const query = { groupId: group._id };
        const [settlements, total] = await Promise.all([
            settlement_model_1.Settlement.find(query)
                .populate('fromUser', 'userId email firstName lastName')
                .populate('toUser', 'userId email firstName lastName')
                .populate('createdBy', 'userId email firstName lastName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            settlement_model_1.Settlement.countDocuments(query)
        ]);
        return { settlements, total };
    }
    /**
     * Update member balances in group
     */
    async updateMemberBalances(groupId, fromUser, toUser, amount) {
        const group = await group_model_1.Group.findOne({ groupId });
        if (!group)
            return;
        // Update payer's balance (reduces what they owe)
        const payerMember = group.members.find((m) => m.userId.toString() === fromUser);
        if (payerMember) {
            const newOwed = new decimal_js_1.default(payerMember.balance.totalOwed.toString())
                .minus(amount)
                .toFixed(2);
            payerMember.balance.totalOwed = mongoose_1.Types.Decimal128.fromString(newOwed);
            payerMember.balance.netBalance = mongoose_1.Types.Decimal128.fromString(new decimal_js_1.default(payerMember.balance.totalLent.toString())
                .minus(newOwed)
                .toFixed(2));
        }
        // Update recipient's balance (reduces what they are owed)
        const recipientMember = group.members.find((m) => m.userId.toString() === toUser);
        if (recipientMember) {
            const newLent = new decimal_js_1.default(recipientMember.balance.totalLent.toString())
                .minus(amount)
                .toFixed(2);
            recipientMember.balance.totalLent = mongoose_1.Types.Decimal128.fromString(newLent);
            recipientMember.balance.netBalance = mongoose_1.Types.Decimal128.fromString(new decimal_js_1.default(newLent)
                .minus(recipientMember.balance.totalOwed.toString())
                .toFixed(2));
        }
        await group.save();
    }
    /**
     * Update related expense splits
     */
    async updateRelatedExpenses(groupId, fromUser, toUser, amount) {
        const group = await group_model_1.Group.findOne({ groupId });
        if (!group)
            return;
        // Find unsettled expenses where fromUser owes toUser
        const expenses = await expense_model_1.Expense.find({
            groupId: group._id,
            'metadata.isDeleted': false,
            'splits.userId': new mongoose_1.Types.ObjectId(fromUser),
            'splits.settlementStatus': 'PENDING',
            paidBy: new mongoose_1.Types.ObjectId(toUser)
        }).sort({ createdAt: 1 });
        let remainingAmount = amount;
        for (const expense of expenses) {
            if (remainingAmount <= 0)
                break;
            const split = expense.splits.find(s => s.userId.toString() === fromUser && s.settlementStatus === 'PENDING');
            if (split) {
                const splitAmount = parseFloat(split.finalAmount.toString());
                if (remainingAmount >= splitAmount) {
                    // Full settlement of this split
                    split.settlementStatus = 'SETTLED';
                    remainingAmount -= splitAmount;
                }
                else {
                    // Partial settlement
                    split.settlementStatus = 'PARTIAL';
                    remainingAmount = 0;
                }
                await expense.save();
            }
        }
    }
}
exports.SettlementService = SettlementService;
exports.settlementService = new SettlementService();
//# sourceMappingURL=settlement.service.js.map
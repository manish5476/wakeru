import { Settlement } from './settlement.model';
import { debtSimplifier, Debt } from './debt.simplifier';
import { Expense } from '../expense/expense.model';
import { Group } from '../group/group.model';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import { redisClient } from '../../config/redis';
import { Decimal128, Types } from 'mongoose';
import crypto from 'crypto';
import Decimal from 'decimal.js';

export class SettlementService {
  /**
   * Get simplified debts for a group
   */
  async getSimplifiedDebts(groupId: string, userId: string): Promise<any> {
    // Verify group membership
    const group = await Group.findOne({
      groupId,
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new ForbiddenError('You are not a member of this group');
    }

    // Get all unsettled expenses
    const expenses = await Expense.find({
      groupId: group._id,
      'metadata.isDeleted': false,
      'splits.settlementStatus': { $ne: 'SETTLED' }
    });

    // Collect all debts
    const debts: Debt[] = [];

    expenses.forEach(expense => {
      const payer = expense.paidBy.toString();
      
      expense.splits.forEach(split => {
        if (split.settlementStatus === 'SETTLED') return;
        
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
    const simplified = debtSimplifier.simplifyDebts(debts);

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
  async getDebtSummary(groupId: string, userId: string): Promise<any> {
    const group = await Group.findOne({
      groupId,
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new ForbiddenError('You are not a member of this group');
    }

    const expenses = await Expense.find({
      groupId: group._id,
      'metadata.isDeleted': false,
      'splits.settlementStatus': { $ne: 'SETTLED' }
    });

    const debts: Debt[] = [];

    expenses.forEach(expense => {
      const payer = expense.paidBy.toString();
      
      expense.splits.forEach(split => {
        if (split.settlementStatus === 'SETTLED') return;
        
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

    return debtSimplifier.getDebtSummary(userId, debts);
  }

  /**
   * Create a settlement
   */
  async createSettlement(
    groupId: string,
    fromUser: string,
    toUser: string,
    amount: number,
    paymentMethod: string,
    createdBy: string
  ): Promise<any> {
    // Verify group membership
    const group = await Group.findOne({
      groupId,
      'members.userId': new Types.ObjectId(fromUser),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new ForbiddenError('Invalid group or user');
    }

    // Verify both users are members
    const toMember = group.members.find(
      m => m.userId.toString() === toUser && m.invitationStatus === 'ACCEPTED'
    );

    if (!toMember) {
      throw new BadRequestError('Recipient is not a member of this group');
    }

    // Check for duplicate settlement
    const idempotencyKey = crypto.randomUUID();
    const existingSettlement = await Settlement.findOne({ idempotencyKey });
    if (existingSettlement) {
      throw new ConflictError('Duplicate settlement detected');
    }

    // Create settlement record
    const settlement = new Settlement({
      settlementId: crypto.randomUUID(),
      groupId: group._id,
      fromUser: new Types.ObjectId(fromUser),
      toUser: new Types.ObjectId(toUser),
      amount: Decimal128.fromString(amount.toFixed(2)),
      currency: group.settings.defaultCurrency,
      expenses: [],
      paymentMethod,
      status: 'PENDING',
      statusHistory: [{
        status: 'PENDING',
        timestamp: new Date(),
        updatedBy: new Types.ObjectId(createdBy),
        remarks: 'Settlement created'
      }],
      createdBy: new Types.ObjectId(createdBy),
      settlementDate: new Date(),
      idempotencyKey
    });

    await settlement.save();

    logger.info(`Settlement created: ${settlement.settlementId}`);
    return settlement;
  }

  /**
   * Process payment for a settlement
   */
  async processPayment(
    settlementId: string,
    paymentDetails: {
      transactionId: string;
      paymentGateway: string;
    },
    userId: string
  ): Promise<any> {
    const settlement = await Settlement.findOne({ settlementId });
    if (!settlement) {
      throw new NotFoundError('Settlement');
    }

    if (settlement.fromUser.toString() !== userId) {
      throw new ForbiddenError('Only the payer can process this settlement');
    }

    if (settlement.status !== 'PENDING') {
      throw new BadRequestError(`Settlement is already ${settlement.status}`);
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
      updatedBy: new Types.ObjectId(userId),
      remarks: 'Payment processed'
    });

    await settlement.save();

    // Update group member balances
    await this.updateMemberBalances(
      settlement.groupId.toString(),
      settlement.fromUser.toString(),
      settlement.toUser.toString(),
      parseFloat(settlement.amount.toString())
    );

    // Update related expenses
    await this.updateRelatedExpenses(
      settlement.groupId.toString(),
      settlement.fromUser.toString(),
      settlement.toUser.toString(),
      parseFloat(settlement.amount.toString())
    );

    // Invalidate caches
    await redisClient.delete(`group:${settlement.groupId}`);

    logger.info(`Settlement completed: ${settlementId}`);
    return settlement;
  }

  /**
   * Cancel a settlement
   */
  async cancelSettlement(settlementId: string, userId: string): Promise<any> {
    const settlement = await Settlement.findOne({ settlementId });
    if (!settlement) {
      throw new NotFoundError('Settlement');
    }

    if (settlement.status === 'COMPLETED') {
      throw new BadRequestError('Cannot cancel a completed settlement');
    }

    settlement.status = 'CANCELLED';
    settlement.statusHistory.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      updatedBy: new Types.ObjectId(userId),
      remarks: 'Settlement cancelled'
    });

    await settlement.save();

    logger.info(`Settlement cancelled: ${settlementId}`);
    return settlement;
  }

  /**
   * Get settlement history for a group
   */
  async getSettlementHistory(groupId: string, userId: string, options: any = {}): Promise<any> {
    const group = await Group.findOne({
      groupId,
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new ForbiddenError('You are not a member of this group');
    }

    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query = { groupId: group._id };

    const [settlements, total] = await Promise.all([
      Settlement.find(query)
        .populate('fromUser', 'userId email firstName lastName')
        .populate('toUser', 'userId email firstName lastName')
        .populate('createdBy', 'userId email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Settlement.countDocuments(query)
    ]);

    return { settlements, total };
  }

  /**
   * Update member balances in group
   */
  private async updateMemberBalances(
    groupId: string,
    fromUser: string,
    toUser: string,
    amount: number
  ): Promise<void> {
    const group = await Group.findOne({ groupId });
    if (!group) return;

    // Update payer's balance (reduces what they owe)
    const payerMember = group.members.find(m => m.userId.toString() === fromUser);
    if (payerMember) {
      const newOwed = new Decimal(payerMember.balance.totalOwed.toString())
        .minus(amount)
        .toFixed(2);
      
      payerMember.balance.totalOwed = Decimal128.fromString(newOwed);
      payerMember.balance.netBalance = Decimal128.fromString(
        new Decimal(payerMember.balance.totalLent.toString())
          .minus(newOwed)
          .toFixed(2)
      );
    }

    // Update recipient's balance (reduces what they are owed)
    const recipientMember = group.members.find(m => m.userId.toString() === toUser);
    if (recipientMember) {
      const newLent = new Decimal(recipientMember.balance.totalLent.toString())
        .minus(amount)
        .toFixed(2);
      
      recipientMember.balance.totalLent = Decimal128.fromString(newLent);
      recipientMember.balance.netBalance = Decimal128.fromString(
        new Decimal(newLent)
          .minus(recipientMember.balance.totalOwed.toString())
          .toFixed(2)
      );
    }

    await group.save();
  }

  /**
   * Update related expense splits
   */
  private async updateRelatedExpenses(
    groupId: string,
    fromUser: string,
    toUser: string,
    amount: number
  ): Promise<void> {
    const group = await Group.findOne({ groupId });
    if (!group) return;

    // Find unsettled expenses where fromUser owes toUser
    const expenses = await Expense.find({
      groupId: group._id,
      'metadata.isDeleted': false,
      'splits.userId': new Types.ObjectId(fromUser),
      'splits.settlementStatus': 'PENDING',
      paidBy: new Types.ObjectId(toUser)
    }).sort({ createdAt: 1 });

    let remainingAmount = amount;

    for (const expense of expenses) {
      if (remainingAmount <= 0) break;

      const split = expense.splits.find(
        s => s.userId.toString() === fromUser && s.settlementStatus === 'PENDING'
      );

      if (split) {
        const splitAmount = parseFloat(split.finalAmount.toString());
        
        if (remainingAmount >= splitAmount) {
          // Full settlement of this split
          split.settlementStatus = 'SETTLED';
          remainingAmount -= splitAmount;
        } else {
          // Partial settlement
          split.settlementStatus = 'PARTIAL';
          remainingAmount = 0;
        }

        await expense.save();
      }
    }
  }
}

export const settlementService = new SettlementService();
import { expenseRepository } from './expense.repository';
import { expenseCalculator } from './expense.calculator';
import { Expense, IExpenseDocument } from './expense.model';
import { CreateExpenseDTO, UpdateExpenseDTO, ISplit } from '../../shared/types/expense.types';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import { redisClient } from '../../config/redis';
import { Types } from 'mongoose';
import { Group, IGroupMember } from '../group/group.model';
import { UserModel } from '../user/user.model';
import crypto from 'crypto';

export class ExpenseService {
  /**
   * Create a new expense with proportional splitting
   */
  async createExpense(expenseData: CreateExpenseDTO, createdBy: string): Promise<IExpenseDocument> {
    // Verify group exists and user is member
    const group = await Group.findOne({ 
      groupId: expenseData.groupId,
      'members.userId': new Types.ObjectId(createdBy),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new NotFoundError('Group not found or you are not a member');
    }

    // Idempotency Check
    if (expenseData.idempotencyKey) {
      const existingExpense = await Expense.findOne({ idempotencyKey: expenseData.idempotencyKey });
      if (existingExpense) {
        logger.info(`Idempotent request processed. Returning existing expense for key: ${expenseData.idempotencyKey}`);
        return existingExpense;
      }
    }

    // Validate expense data
    const validation = expenseCalculator.validateExpense(
      expenseData.lineItems as any,
      expenseData.taxes || []
    );

    if (!validation.isValid) {
      throw new BadRequestError(validation.errors.join('; '));
    }

    // Verify all consumers are group members
    const memberIds = group.members
      .filter((m: IGroupMember) => m.invitationStatus === 'ACCEPTED')
      .map((m: IGroupMember) => m.userId.toString());

    expenseData.lineItems.forEach(item => {
      item.consumers.forEach(consumer => {
        if (!memberIds.includes(consumer.userId)) {
          throw new BadRequestError(`User ${consumer.userId} is not a member of this group`);
        }
      });
    });

    // Use client-provided key or generate a new one
    const idempotencyKey = expenseData.idempotencyKey || crypto.randomUUID();

    // Calculate proportional splits
    const { splits, analytics, totals } = expenseCalculator.calculateProportionalSplit(
      expenseData.lineItems as any,
      expenseData.taxes || [],
      expenseData.discounts || [],
      expenseData.paidBy,
      expenseData.currency
    );

    // Create expense document
    const expenseDoc: Partial<IExpenseDocument> = {
      expenseId: crypto.randomUUID(),
      groupId: group._id,
      description: expenseData.description,
      category: expenseData.category,
      currency: expenseData.currency,
      lineItems: expenseData.lineItems.map(item => ({
        itemId: crypto.randomUUID(),
        name: item.name,
        category: item.category,
        basePrice: Types.Decimal128.fromString(item.basePrice.toFixed(2)),
        quantity: item.quantity,
        consumers: item.consumers.map(c => ({
          userId: new Types.ObjectId(c.userId),
          consumptionPercentage: c.consumptionPercentage,
          quantity: c.quantity,
          notes: c.notes
        }))
      })),
      taxes: expenseData.taxes?.map(tax => ({
        name: tax.name,
        percentage: tax.percentage,
        amount: Types.Decimal128.fromString('0'), // Will be calculated
        applicableTo: tax.applicableTo,
        applicableItems: tax.applicableItems,
        taxCode: tax.taxCode
      })),
      discounts: expenseData.discounts?.map(discount => ({
        type: discount.type,
        value: Types.Decimal128.fromString(discount.value.toFixed(2)),
        code: discount.code,
        description: discount.description,
        applicableTo: discount.applicableTo,
        applicableItems: discount.applicableItems
      })),
      splits,
      paidBy: new Types.ObjectId(expenseData.paidBy),
      paymentMethod: expenseData.paymentMethod,
      paymentDate: expenseData.paymentDate || new Date(),
      totalAmount: totals.totalAmount,
      subTotal: totals.subTotal,
      taxTotal: totals.taxTotal,
      discountTotal: totals.discountTotal,
      analytics,
      metadata: {
        createdBy: new Types.ObjectId(createdBy),
        isDeleted: false,
        version: 1
      },
      idempotencyKey
    };

    const expense = await expenseRepository.createExpense(expenseDoc);

    // Update group financial summary (async)
    this.updateGroupFinancials(group.groupId).catch(err => 
      logger.error('Failed to update group financials:', err)
    );

    // Update user stats (async)
    this.updateUserStats(expense.splits.map(s => s.userId.toString())).catch(err =>
      logger.error('Failed to update user stats:', err)
    );

    // Invalidate caches
    await this.invalidateRelatedCaches(group.groupId, expense.splits as unknown as ISplit[]);

    logger.info(`Expense created: ${expense.expenseId} in group ${group.groupId}`);
    return expense;
  }

  /**
   * Get expense by ID
   */
  async getExpenseById(expenseId: string, userId: string): Promise<IExpenseDocument> {
    const expense = await expenseRepository.findById(expenseId);
    if (!expense) {
      throw new NotFoundError('Expense');
    }

    // Verify user is part of this expense's group
    const group = await Group.findOne({
      _id: expense.groupId,
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new ForbiddenError('You do not have access to this expense');
    }

    return expense;
  }

  /**
   * Get expenses for a group
   */
  async getGroupExpenses(groupId: string, userId: string, options: any = {}): Promise<{ expenses: IExpenseDocument[]; total: number }>{
    // Verify membership
    const group = await Group.findOne({
      groupId,
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new ForbiddenError('You are not a member of this group');
    }

    return expenseRepository.findByGroupId(group._id.toString(), options);
  }

  /**
   * Get user's expenses
   */
  async getUserExpenses(userId: string, options: any = {}): Promise<{ expenses: IExpenseDocument[]; total: number }> {
    return expenseRepository.findByUserId(userId, options);
  }

  /**
   * Update expense
   */
  async updateExpense(expenseId: string, userId: string, updateData: UpdateExpenseDTO): Promise<IExpenseDocument> {
    const expense = await expenseRepository.findById(expenseId);
    if (!expense) {
      throw new NotFoundError('Expense');
    }

    // Check if user is the creator or group admin
    const group = await Group.findOne({
      _id: expense.groupId,
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED'
    });

    if (!group) {
      throw new ForbiddenError('You do not have permission to update this expense');
    }

    const isAdmin = group.members.find(
      (m: IGroupMember) => m.userId.toString() === userId && m.role === 'ADMIN'
    );

    if (expense.metadata.createdBy.toString() !== userId && !isAdmin) {
      throw new ForbiddenError('Only the expense creator or group admin can update this expense');
    }

    // Recalculate if line items changed
    if (updateData.lineItems || updateData.taxes || updateData.discounts) {
      const { splits, analytics, totals } = expenseCalculator.calculateProportionalSplit(
        (updateData.lineItems || expense.lineItems) as any,
        (updateData.taxes || expense.taxes) as any,
        (updateData.discounts || expense.discounts) as any,
        expense.paidBy.toString(),
        expense.currency
      );

      expense.splits = splits as any;
      expense.analytics = analytics;
      expense.totalAmount = totals.totalAmount;
      expense.subTotal = totals.subTotal;
      expense.taxTotal = totals.taxTotal;
      expense.discountTotal = totals.discountTotal;
    }

    if (updateData.description) expense.description = updateData.description;
    if (updateData.category) expense.category = updateData.category;
    
    expense.metadata.version += 1;
    expense.metadata.updatedBy = new Types.ObjectId(userId);

    await expense.save();

    // Invalidate caches
    await this.invalidateRelatedCaches(group.groupId, expense.splits as unknown as ISplit[]);

    logger.info(`Expense updated: ${expenseId}`);
    return expense;
  }

  /**
   * Delete expense (soft delete)
   */
  async deleteExpense(expenseId: string, userId: string): Promise<void> {
    const expense = await expenseRepository.findById(expenseId);
    if (!expense) {
      throw new NotFoundError('Expense');
    }

    // Check permissions
    const group = await Group.findOne({
      _id: expense.groupId,
      'members.userId': new Types.ObjectId(userId)
    });

    if (!group) {
      throw new ForbiddenError('You do not have permission to delete this expense');
    }

    const isAdmin = group.members.find((m: IGroupMember) => m.userId.toString() === userId && m.role === 'ADMIN');
    if (expense.metadata.createdBy.toString() !== userId && !isAdmin) {
      throw new ForbiddenError('Only the expense creator or group admin can delete this expense');
    }

    // Check if any splits are settled
    const hasSettledSplits = expense.splits.some(s => s.settlementStatus === 'SETTLED');
    if (hasSettledSplits) {
      throw new BadRequestError('Cannot delete expense with settled splits');
    }

    await expenseRepository.softDelete(expenseId, userId);

    // Reverse the financial impact
    await this.updateGroupFinancials(group.groupId);
    await this.invalidateRelatedCaches(group.groupId, expense.splits as unknown as ISplit[]);

    logger.info(`Expense deleted: ${expenseId}`);
  }

  /**
   * Update group financial summary
   */
  private async updateGroupFinancials(groupId: string): Promise<void> {
    const stats = await expenseRepository.getGroupExpenseStats(groupId);
    
    if (stats.length > 0) {
      const stat = stats[0];
      await Group.findOneAndUpdate(
        { groupId },
        {
          $set: {
            'financialSummary.totalExpenses': stat.totalExpenses,
            'financialSummary.totalPending': Types.Decimal128.fromString(stat.totalAmount.toFixed(2)),
            'financialSummary.averageExpenseAmount': Types.Decimal128.fromString(stat.averageAmount.toFixed(2)),
            'financialSummary.lastExpenseDate': stat.lastExpenseDate,
            'financialSummary.expenseCount': stat.totalExpenses
          }
        }
      );
    }
  }

  /**
   * Update user statistics
   */
  private async updateUserStats(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      const totalExpenses = await Expense.countDocuments({
        'splits.userId': new Types.ObjectId(userId),
        'metadata.isDeleted': false
      });

      await UserModel.findOneAndUpdate(
        { _id: new Types.ObjectId(userId) },
        { 
          $set: { 
            'stats.totalExpenses': totalExpenses,
            'stats.lastActiveAt': new Date()
          } 
        }
      );
    }
  }

  /**
   * Invalidate related caches
   */
  private async invalidateRelatedCaches(groupId: string, splits: ISplit[]): Promise<void> {
    await redisClient.delete(`group:${groupId}`);
    
    // Invalidate user caches
    const userIds = new Set<string>();
    splits.forEach((split: ISplit) => userIds.add(split.userId.toString()));
    
    for (const userId of userIds) {
      await redisClient.delete(`user:${userId}:groups`);
      await redisClient.delete(`user:${userId}:expenses`);
    }
  }
}

export const expenseService = new ExpenseService();
import { groupRepository } from './group.repository';
import { IGroup, IGroupMember } from './group.model';
import { CreateGroupDTO, UpdateGroupDTO } from '../../shared/types/group.types';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import { redisClient } from '../../config/redis';
import { CONSTANTS } from '../../config/constants';
import { Decimal128, Types } from 'mongoose';

export class GroupService {
  /**
   * Create a new group
   */
  async createGroup(createdBy: string, groupData: CreateGroupDTO): Promise<IGroup> {
    // Validate member IDs
    if (groupData.memberIds && groupData.memberIds.length > 50) {
      throw new BadRequestError('Maximum 50 members allowed in a group');
    }

    const group = await groupRepository.createGroup(groupData, createdBy);
    
    // Update user stats (async)
    this.updateUserGroupStats(createdBy).catch(err => 
      logger.error('Failed to update user stats:', err)
    );

    logger.info(`Group created: ${group.groupId} by user ${createdBy}`);
    return group;
  }

  /**
   * Get group by ID
   */
  async getGroupById(groupId: string, userId: string): Promise<IGroup> {
    const cacheKey = `group:${groupId}`;
    
    // Try cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const group = JSON.parse(cached);
      // Verify user is a member
      if (!group.members.some((m: any) => m.userId === userId)) {
        throw new ForbiddenError('You are not a member of this group');
      }
      return group;
    }

    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group');
    }

    // Verify user is a member
    const isMember = group.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this group');
    }

    // Cache for 30 minutes
    await redisClient.set(cacheKey, JSON.stringify(group), CONSTANTS.CACHE_TTL.GROUP_DETAILS);

    return group;
  }

  /**
   * Get all groups for a user
   */
  async getUserGroups(userId: string): Promise<IGroup[]> {
    const cacheKey = `user:${userId}:groups`;
    
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groups = await groupRepository.getUserGroups(userId);

    // Cache for 5 minutes
    await redisClient.set(cacheKey, JSON.stringify(groups), 300);

    return groups;
  }

  /**
   * Update group
   */
  async updateGroup(groupId: string, userId: string, updateData: UpdateGroupDTO): Promise<IGroup> {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group');
    }

    // Check if user is admin
    const member = group.members.find(m => m.userId.toString() === userId);
    if (!member || member.role !== 'ADMIN') {
      throw new ForbiddenError('Only group admins can update group settings');
    }

    const updatedGroup = await groupRepository.updateGroup(groupId, updateData);
    if (!updatedGroup) {
      throw new NotFoundError('Group');
    }

    // Invalidate cache
    await redisClient.delete(`group:${groupId}`);
    await redisClient.delete(`user:${userId}:groups`);

    logger.info(`Group updated: ${groupId} by user ${userId}`);
    return updatedGroup;
  }

  /**
   * Add member to group
   */
  async addMember(groupId: string, adminId: string, newMemberId: string, role: string = 'MEMBER'): Promise<IGroup> {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group');
    }

    // Check if admin
    const adminMember = group.members.find(m => m.userId.toString() === adminId);
    if (!adminMember || adminMember.role !== 'ADMIN') {
      throw new ForbiddenError('Only group admins can add members');
    }

    // Check if user already a member
    const existingMember = group.members.find(m => m.userId.toString() === newMemberId);
    if (existingMember) {
      throw new ConflictError('User is already a member of this group');
    }

    // Check member limit
    const activeMembers = group.members.filter(m => m.invitationStatus === 'ACCEPTED');
    if (activeMembers.length >= 100) {
      throw new BadRequestError('Group has reached maximum member limit (100)');
    }

    const newMember: IGroupMember = {
      userId: new Types.ObjectId(newMemberId),
      role: role as 'ADMIN' | 'MEMBER' | 'VIEWER',
      joinedAt: new Date(),
      invitedBy: new Types.ObjectId(adminId),
      invitationStatus: 'ACCEPTED',
      balance: {
        totalOwed: Decimal128.fromString('0'),
        totalLent: Decimal128.fromString('0'),
        netBalance: Decimal128.fromString('0')
      }
    };

    const updatedGroup = await groupRepository.addMember(groupId, newMember);
    if (!updatedGroup) {
      throw new NotFoundError('Group');
    }

    // Update user stats
    this.updateUserGroupStats(newMemberId).catch(err => 
      logger.error('Failed to update user stats:', err)
    );

    // Invalidate cache
    await redisClient.delete(`group:${groupId}`);
    await redisClient.delete(`user:${newMemberId}:groups`);

    logger.info(`Member added to group ${groupId}: ${newMemberId}`);
    return updatedGroup;
  }

  /**
   * Remove member from group
   */
  async removeMember(groupId: string, adminId: string, memberId: string): Promise<IGroup> {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group');
    }

    // Check permissions
    const adminMember = group.members.find(m => m.userId.toString() === adminId);
    const isSelfRemoval = adminId === memberId;
    
    if (!isSelfRemoval && (!adminMember || adminMember.role !== 'ADMIN')) {
      throw new ForbiddenError('Only group admins can remove members');
    }

    // Cannot remove the last admin
    if (adminMember?.role === 'ADMIN') {
      const adminCount = group.members.filter(m => m.role === 'ADMIN').length;
      if (adminCount === 1 && isSelfRemoval) {
        throw new BadRequestError('Cannot remove the last admin. Promote another member first.');
      }
    }

    // Check if member has pending balances
    const member = group.members.find(m => m.userId.toString() === memberId);
    if (member && parseFloat(member.balance.netBalance.toString()) !== 0) {
      throw new BadRequestError('Cannot remove member with pending balances. Settle all dues first.');
    }

    const updatedGroup = await groupRepository.removeMember(groupId, memberId);
    if (!updatedGroup) {
      throw new NotFoundError('Group');
    }

    // Update user stats
    this.updateUserGroupStats(memberId).catch(err => 
      logger.error('Failed to update user stats:', err)
    );

    // Invalidate cache
    await redisClient.delete(`group:${groupId}`);
    await redisClient.delete(`user:${memberId}:groups`);

    logger.info(`Member removed from group ${groupId}: ${memberId}`);
    return updatedGroup;
  }

  /**
   * Update member role
   */
  async updateMemberRole(groupId: string, adminId: string, memberId: string, newRole: string): Promise<IGroup> {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group');
    }

    // Check if admin
    const adminMember = group.members.find(m => m.userId.toString() === adminId);
    if (!adminMember || adminMember.role !== 'ADMIN') {
      throw new ForbiddenError('Only group admins can change member roles');
    }

    // Cannot change own role if last admin
    if (adminId === memberId && newRole !== 'ADMIN') {
      const adminCount = group.members.filter(m => m.role === 'ADMIN').length;
      if (adminCount === 1) {
        throw new BadRequestError('Cannot demote the last admin. Promote another member first.');
      }
    }

    const updatedGroup = await groupRepository.updateMemberRole(groupId, memberId, newRole);
    if (!updatedGroup) {
      throw new NotFoundError('Group');
    }

    await redisClient.delete(`group:${groupId}`);

    logger.info(`Member role updated in group ${groupId}: ${memberId} -> ${newRole}`);
    return updatedGroup;
  }

  /**
   * Join group by invite code
   */
  async joinByInviteCode(inviteCode: string, userId: string): Promise<IGroup> {
    const group = await groupRepository.findByInviteCode(inviteCode);
    if (!group) {
      throw new NotFoundError('Invalid invite code or group not found');
    }

    // Check if already a member
    const existingMember = group.members.find(m => m.userId.toString() === userId);
    if (existingMember) {
      if (existingMember.invitationStatus === 'ACCEPTED') {
        throw new ConflictError('You are already a member of this group');
      }
      // Update pending invitation to accepted
      existingMember.invitationStatus = 'ACCEPTED';
      existingMember.joinedAt = new Date();
      await group.save();
      
      await redisClient.delete(`group:${group.groupId}`);
      await redisClient.delete(`user:${userId}:groups`);
      
      return group;
    }

    // Add as new member
    const newMember: IGroupMember = {
      userId: new Types.ObjectId(userId),
      role: 'MEMBER',
      joinedAt: new Date(),
      invitationStatus: 'ACCEPTED',
      balance: {
        totalOwed: Decimal128.fromString('0'),
        totalLent: Decimal128.fromString('0'),
        netBalance: Decimal128.fromString('0')
      }
    };

    const updatedGroup = await groupRepository.addMember(group.groupId, newMember);
    if (!updatedGroup) {
      throw new NotFoundError('Group');
    }

    await redisClient.delete(`group:${group.groupId}`);
    await redisClient.delete(`user:${userId}:groups`);

    logger.info(`User joined group via invite: ${userId} -> ${group.groupId}`);
    return updatedGroup;
  }

  /**
   * Archive group
   */
  async archiveGroup(groupId: string, userId: string): Promise<IGroup> {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group');
    }

    // Check if admin
    const member = group.members.find(m => m.userId.toString() === userId);
    if (!member || member.role !== 'ADMIN') {
      throw new ForbiddenError('Only group admins can archive groups');
    }

    const archivedGroup = await groupRepository.archiveGroup(groupId, userId);
    if (!archivedGroup) {
      throw new NotFoundError('Group');
    }

    // Invalidate all caches
    for (const member of group.members) {
      await redisClient.delete(`user:${member.userId}:groups`);
    }
    await redisClient.delete(`group:${groupId}`);

    logger.info(`Group archived: ${groupId} by user ${userId}`);
    return archivedGroup;
  }

  /**
   * Get group financial summary
   */
  async getFinancialSummary(groupId: string, userId: string): Promise<any> {
    const group = await this.getGroupById(groupId, userId);
    
    const memberBalances = group.members
      .filter(m => m.invitationStatus === 'ACCEPTED')
      .map(m => ({
        userId: m.userId,
        role: m.role,
        balance: {
          totalOwed: m.balance.totalOwed.toString(),
          totalLent: m.balance.totalLent.toString(),
          netBalance: m.balance.netBalance.toString()
        }
      }));

    return {
      groupName: group.name,
      totalExpenses: group.financialSummary.totalExpenses,
      totalSettled: group.financialSummary.totalSettled.toString(),
      totalPending: group.financialSummary.totalPending.toString(),
      averageExpense: group.financialSummary.averageExpenseAmount.toString(),
      lastExpenseDate: group.financialSummary.lastExpenseDate,
      memberBalances,
      currency: group.settings.defaultCurrency
    };
  }

  /**
   * Update user's group count stats
   */
  private async updateUserGroupStats(userId: string): Promise<void> {
    const { UserModel } = require('../user/user.model');
    const groups = await groupRepository.getUserGroups(userId);
    
    await UserModel.findOneAndUpdate(
      { _id: new Types.ObjectId(userId) },
      { 
        $set: { 
          'stats.totalGroups': groups.length,
          'stats.lastActiveAt': new Date()
        } 
      }
    );
  }

  /**
   * Search groups
   */
  async searchGroups(query: string, userId: string): Promise<IGroup[]> {
    if (!query || query.length < 2) {
      throw new BadRequestError('Search query must be at least 2 characters');
    }

    return groupRepository.searchGroups(query, userId);
  }
}

export const groupService = new GroupService();
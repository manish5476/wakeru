"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupService = exports.GroupService = void 0;
const group_repository_1 = require("./group.repository");
const AppError_1 = require("../../shared/errors/AppError");
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
const constants_1 = require("../../config/constants");
const mongoose_1 = require("mongoose");
const user_model_1 = require("../user/user.model");
class GroupService {
    /**
     * Create a new group
     */
    async createGroup(createdBy, groupData) {
        // Validate member IDs
        if (groupData.memberIds && groupData.memberIds.length > 50) {
            throw new AppError_1.BadRequestError('Maximum 50 members allowed in a group');
        }
        const group = await group_repository_1.groupRepository.createGroup(groupData, createdBy);
        // Update user stats (async)
        this.updateUserGroupStats(createdBy).catch(err => logger_1.logger.error('Failed to update user stats:', err));
        logger_1.logger.info(`Group created: ${group.groupId} by user ${createdBy}`);
        return group;
    }
    /**
     * Get group by ID
     */
    async getGroupById(groupId, userId) {
        const cacheKey = `group:${groupId}`;
        // Try cache
        const cached = await redis_1.redisClient.get(cacheKey);
        if (cached) {
            const group = JSON.parse(cached);
            // Verify user is a member
            if (!group.members.some((m) => m.userId.toString() === userId)) {
                throw new AppError_1.ForbiddenError('You are not a member of this group');
            }
            return group;
        }
        const group = await group_repository_1.groupRepository.findById(groupId);
        if (!group) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Verify user is a member
        const isMember = group.members.some((m) => m.userId.toString() === userId);
        if (!isMember) {
            throw new AppError_1.ForbiddenError('You are not a member of this group');
        }
        // Cache for 30 minutes
        await redis_1.redisClient.set(cacheKey, JSON.stringify(group), constants_1.CONSTANTS.CACHE_TTL.GROUP_DETAILS);
        return group;
    }
    /**
     * Get all groups for a user
     */
    async getUserGroups(userId) {
        const cacheKey = `user:${userId}:groups`;
        const cached = await redis_1.redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        const groups = await group_repository_1.groupRepository.getUserGroups(userId);
        // Cache for 5 minutes
        await redis_1.redisClient.set(cacheKey, JSON.stringify(groups), 300);
        return groups;
    }
    /**
     * Update group
     */
    async updateGroup(groupId, userId, updateData) {
        const group = await group_repository_1.groupRepository.findById(groupId);
        if (!group) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Check if user is admin
        const member = group.members.find((m) => m.userId.toString() === userId);
        if (!member || member.role !== 'ADMIN') {
            throw new AppError_1.ForbiddenError('Only group admins can update group settings');
        }
        const updatedGroup = await group_repository_1.groupRepository.updateGroup(groupId, updateData);
        if (!updatedGroup) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Invalidate cache
        await redis_1.redisClient.delete(`group:${groupId}`);
        await redis_1.redisClient.delete(`user:${userId}:groups`);
        logger_1.logger.info(`Group updated: ${groupId} by user ${userId}`);
        return updatedGroup;
    }
    /**
     * Add member to group
     */
    async addMember(groupId, adminId, newMemberId, role = 'MEMBER') {
        const group = await group_repository_1.groupRepository.findById(groupId);
        if (!group) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Check if admin
        const adminMember = group.members.find((m) => m.userId.toString() === adminId);
        if (!adminMember || adminMember.role !== 'ADMIN') {
            throw new AppError_1.ForbiddenError('Only group admins can add members');
        }
        // Check if user already a member
        const existingMember = group.members.find((m) => m.userId.toString() === newMemberId);
        if (existingMember) {
            throw new AppError_1.ConflictError('User is already a member of this group');
        }
        // Check member limit
        const activeMembers = group.members.filter((m) => m.invitationStatus === 'ACCEPTED');
        if (activeMembers.length >= 100) {
            throw new AppError_1.BadRequestError('Group has reached maximum member limit (100)');
        }
        const newMember = {
            userId: new mongoose_1.Types.ObjectId(newMemberId),
            role: role,
            joinedAt: new Date(),
            invitedBy: new mongoose_1.Types.ObjectId(adminId),
            invitationStatus: 'ACCEPTED',
            balance: {
                totalOwed: mongoose_1.Types.Decimal128.fromString('0'),
                totalLent: mongoose_1.Types.Decimal128.fromString('0'),
                netBalance: mongoose_1.Types.Decimal128.fromString('0')
            }
        };
        const updatedGroup = await group_repository_1.groupRepository.addMember(groupId, newMember);
        if (!updatedGroup) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Update user stats
        this.updateUserGroupStats(newMemberId).catch(err => logger_1.logger.error('Failed to update user stats:', err));
        // Invalidate cache
        await redis_1.redisClient.delete(`group:${groupId}`);
        await redis_1.redisClient.delete(`user:${newMemberId}:groups`);
        logger_1.logger.info(`Member added to group ${groupId}: ${newMemberId}`);
        return updatedGroup;
    }
    /**
     * Remove member from group
     */
    async removeMember(groupId, adminId, memberId) {
        const group = await group_repository_1.groupRepository.findById(groupId);
        if (!group) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Check permissions
        const adminMember = group.members.find((m) => m.userId.toString() === adminId);
        const isSelfRemoval = adminId === memberId;
        if (!isSelfRemoval && (!adminMember || adminMember.role !== 'ADMIN')) {
            throw new AppError_1.ForbiddenError('Only group admins can remove members');
        }
        // Cannot remove the last admin
        if (adminMember?.role === 'ADMIN') {
            const adminCount = group.members.filter((m) => m.role === 'ADMIN').length;
            if (adminCount === 1 && isSelfRemoval) {
                throw new AppError_1.BadRequestError('Cannot remove the last admin. Promote another member first.');
            }
        }
        // Check if member has pending balances
        const member = group.members.find((m) => m.userId.toString() === memberId);
        if (member && parseFloat(member.balance.netBalance.toString()) !== 0) {
            throw new AppError_1.BadRequestError('Cannot remove member with pending balances. Settle all dues first.');
        }
        const updatedGroup = await group_repository_1.groupRepository.removeMember(groupId, memberId);
        if (!updatedGroup) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Update user stats
        this.updateUserGroupStats(memberId).catch(err => logger_1.logger.error('Failed to update user stats:', err));
        // Invalidate cache
        await redis_1.redisClient.delete(`group:${groupId}`);
        await redis_1.redisClient.delete(`user:${memberId}:groups`);
        logger_1.logger.info(`Member removed from group ${groupId}: ${memberId}`);
        return updatedGroup;
    }
    /**
     * Update member role
     */
    async updateMemberRole(groupId, adminId, memberId, newRole) {
        const group = await group_repository_1.groupRepository.findById(groupId);
        if (!group) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Check if admin
        const adminMember = group.members.find((m) => m.userId.toString() === adminId);
        if (!adminMember || adminMember.role !== 'ADMIN') {
            throw new AppError_1.ForbiddenError('Only group admins can change member roles');
        }
        // Cannot change own role if last admin
        if (adminId === memberId && newRole !== 'ADMIN') {
            const adminCount = group.members.filter((m) => m.role === 'ADMIN').length;
            if (adminCount === 1) {
                throw new AppError_1.BadRequestError('Cannot demote the last admin. Promote another member first.');
            }
        }
        const updatedGroup = await group_repository_1.groupRepository.updateMemberRole(groupId, memberId, newRole);
        if (!updatedGroup) {
            throw new AppError_1.NotFoundError('Group');
        }
        await redis_1.redisClient.delete(`group:${groupId}`);
        logger_1.logger.info(`Member role updated in group ${groupId}: ${memberId} -> ${newRole}`);
        return updatedGroup;
    }
    /**
     * Join group by invite code
     */
    async joinByInviteCode(inviteCode, userId) {
        const group = await group_repository_1.groupRepository.findByInviteCode(inviteCode);
        if (!group) {
            throw new AppError_1.NotFoundError('Invalid invite code or group not found');
        }
        // Check if already a member
        const existingMember = group.members.find((m) => m.userId.toString() === userId);
        if (existingMember) {
            if (existingMember.invitationStatus === 'ACCEPTED') {
                throw new AppError_1.ConflictError('You are already a member of this group');
            }
            // Update pending invitation to accepted
            existingMember.invitationStatus = 'ACCEPTED';
            existingMember.joinedAt = new Date();
            await group.save();
            await redis_1.redisClient.delete(`group:${group.groupId}`);
            await redis_1.redisClient.delete(`user:${userId}:groups`);
            return group;
        }
        // Add as new member
        const newMember = {
            userId: new mongoose_1.Types.ObjectId(userId),
            role: 'MEMBER',
            joinedAt: new Date(),
            invitationStatus: 'ACCEPTED',
            balance: {
                totalOwed: mongoose_1.Types.Decimal128.fromString('0'),
                totalLent: mongoose_1.Types.Decimal128.fromString('0'),
                netBalance: mongoose_1.Types.Decimal128.fromString('0')
            }
        };
        const updatedGroup = await group_repository_1.groupRepository.addMember(group.groupId, newMember);
        if (!updatedGroup) {
            throw new AppError_1.NotFoundError('Group');
        }
        await redis_1.redisClient.delete(`group:${group.groupId}`);
        await redis_1.redisClient.delete(`user:${userId}:groups`);
        logger_1.logger.info(`User joined group via invite: ${userId} -> ${group.groupId}`);
        return updatedGroup;
    }
    /**
     * Archive group
     */
    async archiveGroup(groupId, userId) {
        const group = await group_repository_1.groupRepository.findById(groupId);
        if (!group) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Check if admin
        const member = group.members.find((m) => m.userId.toString() === userId);
        if (!member || member.role !== 'ADMIN') {
            throw new AppError_1.ForbiddenError('Only group admins can archive groups');
        }
        const archivedGroup = await group_repository_1.groupRepository.archiveGroup(groupId, userId);
        if (!archivedGroup) {
            throw new AppError_1.NotFoundError('Group');
        }
        // Invalidate all caches
        for (const member of group.members) {
            await redis_1.redisClient.delete(`user:${member.userId.toString()}:groups`);
        }
        await redis_1.redisClient.delete(`group:${groupId}`);
        logger_1.logger.info(`Group archived: ${groupId} by user ${userId}`);
        return archivedGroup;
    }
    /**
     * Get group financial summary
     */
    async getFinancialSummary(groupId, userId) {
        const group = await this.getGroupById(groupId, userId);
        const memberBalances = group.members
            .filter((m) => m.invitationStatus === 'ACCEPTED')
            .map((m) => ({
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
    async updateUserGroupStats(userId) {
        const groups = await group_repository_1.groupRepository.getUserGroups(userId);
        await user_model_1.UserModel.findOneAndUpdate({ _id: new mongoose_1.Types.ObjectId(userId) }, {
            $set: {
                'stats.totalGroups': groups.length,
                'stats.lastActiveAt': new Date()
            }
        });
    }
    /**
     * Search groups
     */
    async searchGroups(query, userId) {
        if (!query || query.length < 2) {
            throw new AppError_1.BadRequestError('Search query must be at least 2 characters');
        }
        return group_repository_1.groupRepository.searchGroups(query, userId);
    }
}
exports.GroupService = GroupService;
exports.groupService = new GroupService();
//# sourceMappingURL=group.service.js.map
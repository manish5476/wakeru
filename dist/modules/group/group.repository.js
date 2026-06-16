"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupRepository = exports.GroupRepository = void 0;
const group_model_1 = require("./group.model");
const mongoose_1 = require("mongoose");
class GroupRepository {
    async createGroup(groupData, createdBy) {
        const memberIds = groupData.memberIds || [];
        const members = [
            {
                userId: new mongoose_1.Types.ObjectId(createdBy),
                role: 'ADMIN',
                joinedAt: new Date(),
                invitationStatus: 'ACCEPTED',
                balance: {
                    totalOwed: mongoose_1.Types.Decimal128.fromString('0'),
                    totalLent: mongoose_1.Types.Decimal128.fromString('0'),
                    netBalance: mongoose_1.Types.Decimal128.fromString('0')
                }
            },
            ...memberIds.map(id => ({
                userId: new mongoose_1.Types.ObjectId(id),
                role: 'MEMBER',
                joinedAt: new Date(),
                invitedBy: new mongoose_1.Types.ObjectId(createdBy),
                invitationStatus: 'ACCEPTED',
                balance: {
                    totalOwed: mongoose_1.Types.Decimal128.fromString('0'),
                    totalLent: mongoose_1.Types.Decimal128.fromString('0'),
                    netBalance: mongoose_1.Types.Decimal128.fromString('0')
                }
            }))
        ];
        const group = new group_model_1.Group({
            name: groupData.name,
            description: groupData.description,
            type: groupData.type,
            avatar: groupData.avatar,
            members,
            createdBy: new mongoose_1.Types.ObjectId(createdBy),
            settings: {
                ...groupData.settings,
                defaultCurrency: groupData.settings?.defaultCurrency || 'INR',
                defaultSplitType: groupData.settings?.defaultSplitType || 'PROPORTIONAL',
                categories: groupData.settings?.categories || [
                    'Food & Dining',
                    'Transportation',
                    'Accommodation',
                    'Entertainment',
                    'Shopping',
                    'Groceries',
                    'Utilities',
                    'Other'
                ]
            }
        });
        return group.save();
    }
    async findById(groupId) {
        return group_model_1.Group.findOne({ groupId, isActive: true, isArchived: false })
            .populate('members.userId', 'userId email firstName lastName displayName profilePicture')
            .populate('createdBy', 'userId email firstName lastName displayName profilePicture');
    }
    async findByIdWithDeleted(groupId) {
        return group_model_1.Group.findOne({ groupId });
    }
    async getUserGroups(userId) {
        return group_model_1.Group.find({
            'members.userId': new mongoose_1.Types.ObjectId(userId),
            'members.invitationStatus': 'ACCEPTED',
            isActive: true,
            isArchived: false
        })
            .populate('members.userId', 'userId email firstName lastName displayName profilePicture')
            .sort({ 'financialSummary.lastExpenseDate': -1 });
    }
    async updateGroup(groupId, updateData) {
        return group_model_1.Group.findOneAndUpdate({ groupId }, { $set: updateData }, { new: true, runValidators: true }).populate('members.userId', 'userId email firstName lastName displayName profilePicture');
    }
    async addMember(groupId, memberData) {
        return group_model_1.Group.findOneAndUpdate({ groupId }, { $push: { members: memberData } }, { new: true });
    }
    async removeMember(groupId, userId) {
        return group_model_1.Group.findOneAndUpdate({ groupId }, { $pull: { members: { userId: new mongoose_1.Types.ObjectId(userId) } } }, { new: true });
    }
    async updateMemberRole(groupId, userId, role) {
        return group_model_1.Group.findOneAndUpdate({
            groupId,
            'members.userId': new mongoose_1.Types.ObjectId(userId)
        }, { $set: { 'members.$.role': role } }, { new: true });
    }
    async updateMemberBalance(groupId, userId, balance) {
        await group_model_1.Group.findOneAndUpdate({
            groupId,
            'members.userId': new mongoose_1.Types.ObjectId(userId)
        }, { $set: { 'members.$.balance': balance } });
    }
    async updateFinancialSummary(groupId, summary) {
        await group_model_1.Group.findOneAndUpdate({ groupId }, { $set: { financialSummary: summary } });
    }
    async archiveGroup(groupId, archivedBy) {
        return group_model_1.Group.findOneAndUpdate({ groupId }, {
            $set: {
                isArchived: true,
                isActive: false,
                archivedAt: new Date(),
                archivedBy: new mongoose_1.Types.ObjectId(archivedBy)
            }
        }, { new: true });
    }
    async deleteGroup(groupId) {
        await group_model_1.Group.findOneAndUpdate({ groupId }, { $set: { isActive: false, isArchived: true } });
    }
    async findByInviteCode(inviteCode) {
        return group_model_1.Group.findOne({
            'settings.inviteCode': inviteCode,
            isActive: true,
            isArchived: false
        });
    }
    async searchGroups(query, userId) {
        const searchRegex = new RegExp(query, 'i');
        return group_model_1.Group.find({
            'members.userId': new mongoose_1.Types.ObjectId(userId),
            'members.invitationStatus': 'ACCEPTED',
            isActive: true,
            isArchived: false,
            $or: [
                { name: searchRegex },
                { description: searchRegex },
                { tags: searchRegex }
            ]
        }).populate('members.userId', 'userId email firstName lastName displayName profilePicture');
    }
    async getGroupStats(groupId) {
        return group_model_1.Group.aggregate([
            { $match: { groupId } },
            {
                $project: {
                    name: 1,
                    type: 1,
                    memberCount: { $size: '$members' },
                    totalExpenses: '$financialSummary.totalExpenses',
                    totalSettled: '$financialSummary.totalSettled',
                    totalPending: '$financialSummary.totalPending',
                    averageExpense: '$financialSummary.averageExpenseAmount',
                    createdAt: 1,
                    lastExpenseDate: '$financialSummary.lastExpenseDate'
                }
            }
        ]);
    }
    async getMostActiveGroups(limit = 10) {
        return group_model_1.Group.find({ isActive: true, isArchived: false })
            .sort({ 'financialSummary.totalExpenses': -1 })
            .limit(limit)
            .select('name type financialSummary memberCount');
    }
}
exports.GroupRepository = GroupRepository;
exports.groupRepository = new GroupRepository();
//# sourceMappingURL=group.repository.js.map
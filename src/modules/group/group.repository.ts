import { Group, IGroup, IGroupMember } from './group.model';
import { Types, Decimal128 } from 'mongoose';
import { CreateGroupDTO, UpdateGroupDTO } from '../../shared/types/group.types';

export class GroupRepository {
  async createGroup(groupData: CreateGroupDTO, createdBy: string): Promise<IGroup> {
    const memberIds = groupData.memberIds || [];
    const members: IGroupMember[] = [
      {
        userId: new Types.ObjectId(createdBy),
        role: 'ADMIN',
        joinedAt: new Date(),
        invitationStatus: 'ACCEPTED',
        balance: {
          totalOwed: Decimal128.fromString('0'),
          totalLent: Decimal128.fromString('0'),
          netBalance: Decimal128.fromString('0')
        }
      },
      ...memberIds.map(id => ({
        userId: new Types.ObjectId(id),
        role: 'MEMBER' as const,
        joinedAt: new Date(),
        invitedBy: new Types.ObjectId(createdBy),
        invitationStatus: 'ACCEPTED' as const,
        balance: {
          totalOwed: Decimal128.fromString('0'),
          totalLent: Decimal128.fromString('0'),
          netBalance: Decimal128.fromString('0')
        }
      }))
    ];

    const group = new Group({
      name: groupData.name,
      description: groupData.description,
      type: groupData.type,
      avatar: groupData.avatar,
      members,
      createdBy: new Types.ObjectId(createdBy),
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

  async findById(groupId: string): Promise<IGroup | null> {
    return Group.findOne({ groupId, isActive: true, isArchived: false })
      .populate('members.userId', 'userId email firstName lastName displayName profilePicture')
      .populate('createdBy', 'userId email firstName lastName displayName profilePicture');
  }

  async findByIdWithDeleted(groupId: string): Promise<IGroup | null> {
    return Group.findOne({ groupId });
  }

  async getUserGroups(userId: string): Promise<IGroup[]> {
    return Group.find({
      'members.userId': new Types.ObjectId(userId),
      'members.invitationStatus': 'ACCEPTED',
      isActive: true,
      isArchived: false
    })
    .populate('members.userId', 'userId email firstName lastName displayName profilePicture')
    .sort({ 'financialSummary.lastExpenseDate': -1 });
  }

  async updateGroup(groupId: string, updateData: UpdateGroupDTO): Promise<IGroup | null> {
    return Group.findOneAndUpdate(
      { groupId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('members.userId', 'userId email firstName lastName displayName profilePicture');
  }

  async addMember(groupId: string, memberData: IGroupMember): Promise<IGroup | null> {
    return Group.findOneAndUpdate(
      { groupId },
      { $push: { members: memberData } },
      { new: true }
    );
  }

  async removeMember(groupId: string, userId: string): Promise<IGroup | null> {
    return Group.findOneAndUpdate(
      { groupId },
      { $pull: { members: { userId: new Types.ObjectId(userId) } } },
      { new: true }
    );
  }

  async updateMemberRole(groupId: string, userId: string, role: string): Promise<IGroup | null> {
    return Group.findOneAndUpdate(
      { 
        groupId, 
        'members.userId': new Types.ObjectId(userId) 
      },
      { $set: { 'members.$.role': role } },
      { new: true }
    );
  }

  async updateMemberBalance(
    groupId: string, 
    userId: string, 
    balance: { totalOwed: Decimal128; totalLent: Decimal128; netBalance: Decimal128 }
  ): Promise<void> {
    await Group.findOneAndUpdate(
      { 
        groupId, 
        'members.userId': new Types.ObjectId(userId) 
      },
      { $set: { 'members.$.balance': balance } }
    );
  }

  async updateFinancialSummary(groupId: string, summary: Partial<IGroup['financialSummary']>): Promise<void> {
    await Group.findOneAndUpdate(
      { groupId },
      { $set: { financialSummary: summary } }
    );
  }

  async archiveGroup(groupId: string, archivedBy: string): Promise<IGroup | null> {
    return Group.findOneAndUpdate(
      { groupId },
      { 
        $set: { 
          isArchived: true,
          isActive: false,
          archivedAt: new Date(),
          archivedBy: new Types.ObjectId(archivedBy)
        } 
      },
      { new: true }
    );
  }

  async deleteGroup(groupId: string): Promise<void> {
    await Group.findOneAndUpdate(
      { groupId },
      { $set: { isActive: false, isArchived: true } }
    );
  }

  async findByInviteCode(inviteCode: string): Promise<IGroup | null> {
    return Group.findOne({ 
      'settings.inviteCode': inviteCode,
      isActive: true,
      isArchived: false
    });
  }

  async searchGroups(query: string, userId: string): Promise<IGroup[]> {
    const searchRegex = new RegExp(query, 'i');
    return Group.find({
      'members.userId': new Types.ObjectId(userId),
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

  async getGroupStats(groupId: string): Promise<any> {
    return Group.aggregate([
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

  async getMostActiveGroups(limit: number = 10): Promise<IGroup[]> {
    return Group.find({ isActive: true, isArchived: false })
      .sort({ 'financialSummary.totalExpenses': -1 })
      .limit(limit)
      .select('name type financialSummary memberCount');
  }
}

export const groupRepository = new GroupRepository();
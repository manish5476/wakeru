import { IGroup, IGroupMember } from './group.model';
import { Types } from 'mongoose';
import { CreateGroupDTO, UpdateGroupDTO } from '../../shared/types/group.types';
export declare class GroupRepository {
    createGroup(groupData: CreateGroupDTO, createdBy: string): Promise<IGroup>;
    findById(groupId: string): Promise<IGroup | null>;
    findByIdWithDeleted(groupId: string): Promise<IGroup | null>;
    getUserGroups(userId: string): Promise<IGroup[]>;
    updateGroup(groupId: string, updateData: UpdateGroupDTO): Promise<IGroup | null>;
    addMember(groupId: string, memberData: IGroupMember): Promise<IGroup | null>;
    removeMember(groupId: string, userId: string): Promise<IGroup | null>;
    updateMemberRole(groupId: string, userId: string, role: string): Promise<IGroup | null>;
    updateMemberBalance(groupId: string, userId: string, balance: {
        totalOwed: Types.Decimal128;
        totalLent: Types.Decimal128;
        netBalance: Types.Decimal128;
    }): Promise<void>;
    updateFinancialSummary(groupId: string, summary: Partial<IGroup['financialSummary']>): Promise<void>;
    archiveGroup(groupId: string, archivedBy: string): Promise<IGroup | null>;
    deleteGroup(groupId: string): Promise<void>;
    findByInviteCode(inviteCode: string): Promise<IGroup | null>;
    searchGroups(query: string, userId: string): Promise<IGroup[]>;
    getGroupStats(groupId: string): Promise<any>;
    getMostActiveGroups(limit?: number): Promise<IGroup[]>;
}
export declare const groupRepository: GroupRepository;
//# sourceMappingURL=group.repository.d.ts.map
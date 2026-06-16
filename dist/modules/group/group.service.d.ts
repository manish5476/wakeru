import { IGroup } from './group.model';
import { CreateGroupDTO, UpdateGroupDTO } from '../../shared/types/group.types';
export declare class GroupService {
    /**
     * Create a new group
     */
    createGroup(createdBy: string, groupData: CreateGroupDTO): Promise<IGroup>;
    /**
     * Get group by ID
     */
    getGroupById(groupId: string, userId: string): Promise<IGroup>;
    /**
     * Get all groups for a user
     */
    getUserGroups(userId: string): Promise<IGroup[]>;
    /**
     * Update group
     */
    updateGroup(groupId: string, userId: string, updateData: UpdateGroupDTO): Promise<IGroup>;
    /**
     * Add member to group
     */
    addMember(groupId: string, adminId: string, newMemberId: string, role?: string): Promise<IGroup>;
    /**
     * Remove member from group
     */
    removeMember(groupId: string, adminId: string, memberId: string): Promise<IGroup>;
    /**
     * Update member role
     */
    updateMemberRole(groupId: string, adminId: string, memberId: string, newRole: string): Promise<IGroup>;
    /**
     * Join group by invite code
     */
    joinByInviteCode(inviteCode: string, userId: string): Promise<IGroup>;
    /**
     * Archive group
     */
    archiveGroup(groupId: string, userId: string): Promise<IGroup>;
    /**
     * Get group financial summary
     */
    getFinancialSummary(groupId: string, userId: string): Promise<any>;
    /**
     * Update user's group count stats
     */
    private updateUserGroupStats;
    /**
     * Search groups
     */
    searchGroups(query: string, userId: string): Promise<IGroup[]>;
}
export declare const groupService: GroupService;
//# sourceMappingURL=group.service.d.ts.map
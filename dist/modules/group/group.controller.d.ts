import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class GroupController {
    /**
     * Create group
     */
    createGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get group by ID
     */
    getGroupById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user's groups
     */
    getUserGroups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update group
     */
    updateGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Add member to group
     */
    addMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Remove member from group
     */
    removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update member role
     */
    updateMemberRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Join group by invite code
     */
    joinByInviteCode(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Archive group
     */
    archiveGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get financial summary
     */
    getFinancialSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Search groups
     */
    searchGroups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const groupController: GroupController;
//# sourceMappingURL=group.controller.d.ts.map
import { Request, Response, NextFunction } from 'express';
import { groupService } from './group.service';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
import { 
  createGroupSchema,
  updateGroupSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  joinByInviteSchema,
  searchGroupsSchema
} from './group.validation';
import { ValidationError } from '../../shared/errors/AppError';

export class GroupController {
  /**
   * Create group
   */
  async createGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = createGroupSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const group = await groupService.createGroup(req.user!.userId, value);

      const response: ApiResponse = {
        success: true,
        message: 'Group created successfully',
        data: { group },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get group by ID
   */
  async getGroupById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.params;
      const group = await groupService.getGroupById(groupId, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        data: { group },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's groups
   */
  async getUserGroups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const groups = await groupService.getUserGroups(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        data: { groups },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update group
   */
  async updateGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.params;
      const { error, value } = updateGroupSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const group = await groupService.updateGroup(groupId, req.user!.userId, value);

      const response: ApiResponse = {
        success: true,
        message: 'Group updated successfully',
        data: { group },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add member to group
   */
  async addMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.params;
      const { error, value } = addMemberSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const group = await groupService.addMember(groupId, req.user!.userId, value.userId, value.role);

      const response: ApiResponse = {
        success: true,
        message: 'Member added successfully',
        data: { group },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove member from group
   */
  async removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId, memberId } = req.params;
      const group = await groupService.removeMember(groupId, req.user!.userId, memberId);

      const response: ApiResponse = {
        success: true,
        message: 'Member removed successfully',
        data: { group },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId, memberId } = req.params;
      const { error, value } = updateMemberRoleSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const group = await groupService.updateMemberRole(groupId, req.user!.userId, memberId, value.role);

      const response: ApiResponse = {
        success: true,
        message: 'Member role updated successfully',
        data: { group },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Join group by invite code
   */
  async joinByInviteCode(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = joinByInviteSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const group = await groupService.joinByInviteCode(value.inviteCode, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Joined group successfully',
        data: { group },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Archive group
   */
  async archiveGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.params;
      const group = await groupService.archiveGroup(groupId, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Group archived successfully',
        data: { group },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get financial summary
   */
  async getFinancialSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.params;
      const summary = await groupService.getFinancialSummary(groupId, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        data: { summary },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search groups
   */
  async searchGroups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = searchGroupsSchema.validate(req.query);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const groups = await groupService.searchGroups(value.query, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        data: { groups },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const groupController = new GroupController();
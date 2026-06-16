"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupController = exports.GroupController = void 0;
const group_service_1 = require("./group.service");
const group_validation_1 = require("./group.validation");
const AppError_1 = require("../../shared/errors/AppError");
class GroupController {
    /**
     * Create group
     */
    async createGroup(req, res, next) {
        try {
            const { error, value } = group_validation_1.createGroupSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const group = await group_service_1.groupService.createGroup(req.user.userId, value);
            const response = {
                success: true,
                message: 'Group created successfully',
                data: { group },
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get group by ID
     */
    async getGroupById(req, res, next) {
        try {
            const { groupId } = req.params;
            const group = await group_service_1.groupService.getGroupById(groupId, req.user.userId);
            const response = {
                success: true,
                message: 'Group retrieved successfully',
                data: { group },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's groups
     */
    async getUserGroups(req, res, next) {
        try {
            const groups = await group_service_1.groupService.getUserGroups(req.user.userId);
            const response = {
                success: true,
                message: 'User groups retrieved successfully',
                data: { groups },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update group
     */
    async updateGroup(req, res, next) {
        try {
            const { groupId } = req.params;
            const { error, value } = group_validation_1.updateGroupSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const group = await group_service_1.groupService.updateGroup(groupId, req.user.userId, value);
            const response = {
                success: true,
                message: 'Group updated successfully',
                data: { group },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Add member to group
     */
    async addMember(req, res, next) {
        try {
            const { groupId } = req.params;
            const { error, value } = group_validation_1.addMemberSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const group = await group_service_1.groupService.addMember(groupId, req.user.userId, value.userId, value.role);
            const response = {
                success: true,
                message: 'Member added successfully',
                data: { group },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Remove member from group
     */
    async removeMember(req, res, next) {
        try {
            const { groupId, memberId } = req.params;
            const group = await group_service_1.groupService.removeMember(groupId, req.user.userId, memberId);
            const response = {
                success: true,
                message: 'Member removed successfully',
                data: { group },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update member role
     */
    async updateMemberRole(req, res, next) {
        try {
            const { groupId, memberId } = req.params;
            const { error, value } = group_validation_1.updateMemberRoleSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const group = await group_service_1.groupService.updateMemberRole(groupId, req.user.userId, memberId, value.role);
            const response = {
                success: true,
                message: 'Member role updated successfully',
                data: { group },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Join group by invite code
     */
    async joinByInviteCode(req, res, next) {
        try {
            const { error, value } = group_validation_1.joinByInviteSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const group = await group_service_1.groupService.joinByInviteCode(value.inviteCode, req.user.userId);
            const response = {
                success: true,
                message: 'Joined group successfully',
                data: { group },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Archive group
     */
    async archiveGroup(req, res, next) {
        try {
            const { groupId } = req.params;
            const group = await group_service_1.groupService.archiveGroup(groupId, req.user.userId);
            const response = {
                success: true,
                message: 'Group archived successfully',
                data: { group },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get financial summary
     */
    async getFinancialSummary(req, res, next) {
        try {
            const { groupId } = req.params;
            const summary = await group_service_1.groupService.getFinancialSummary(groupId, req.user.userId);
            const response = {
                success: true,
                message: 'Financial summary retrieved successfully',
                data: { summary },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Search groups
     */
    async searchGroups(req, res, next) {
        try {
            const { error, value } = group_validation_1.searchGroupsSchema.validate(req.query);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const groups = await group_service_1.groupService.searchGroups(value.query, req.user.userId);
            const response = {
                success: true,
                message: 'Groups retrieved successfully',
                data: { groups },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.GroupController = GroupController;
exports.groupController = new GroupController();
//# sourceMappingURL=group.controller.js.map
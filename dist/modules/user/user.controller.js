"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.UserController = void 0;
const user_service_1 = require("./user.service");
const user_validation_1 = require("./user.validation");
const AppError_1 = require("../../shared/errors/AppError");
class UserController {
    /**
     * Get user profile
     */
    async getProfile(req, res, next) {
        try {
            const user = await user_service_1.userService.getUserById(req.user.userId);
            const response = {
                success: true,
                data: { user },
                timestamp: new Date().toISOString(),
                message: ''
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user by ID (public profile)
     */
    async getUserById(req, res, next) {
        try {
            const { userId } = req.params;
            const user = await user_service_1.userService.getPublicProfile(userId);
            const response = {
                success: true,
                data: { user },
                timestamp: new Date().toISOString(),
                message: ''
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update profile
     */
    async updateProfile(req, res, next) {
        try {
            const { error, value } = user_validation_1.updateProfileSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const user = await user_service_1.userService.updateProfile(req.user.userId, value);
            const response = {
                success: true,
                message: 'Profile updated successfully',
                data: { user },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update preferences
     */
    async updatePreferences(req, res, next) {
        try {
            const { error, value } = user_validation_1.updatePreferencesSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const user = await user_service_1.userService.updatePreferences(req.user.userId, value);
            const response = {
                success: true,
                message: 'Preferences updated successfully',
                data: { user },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update banking details
     */
    async updateBankingDetails(req, res, next) {
        try {
            const { error, value } = user_validation_1.updateBankingDetailsSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const user = await user_service_1.userService.updateBankingDetails(req.user.userId, value);
            const response = {
                success: true,
                message: 'Banking details updated successfully',
                data: { user },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Upload profile picture
     */
    async uploadProfilePicture(req, res, next) {
        try {
            if (!req.file) {
                throw new AppError_1.ValidationError('No file uploaded');
            }
            const profilePictureUrl = await user_service_1.userService.uploadProfilePicture(req.user.userId, req.file);
            const response = {
                success: true,
                message: 'Profile picture uploaded successfully',
                data: { profilePicture: profilePictureUrl },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete account
     */
    async deleteAccount(req, res, next) {
        try {
            await user_service_1.userService.deleteAccount(req.user.userId);
            const response = {
                success: true,
                message: 'Account deleted successfully',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Deactivate account
     */
    async deactivateAccount(req, res, next) {
        try {
            const user = await user_service_1.userService.deactivateAccount(req.user.userId);
            const response = {
                success: true,
                message: 'Account deactivated successfully',
                data: { user },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Reactivate account
     */
    async reactivateAccount(req, res, next) {
        try {
            const user = await user_service_1.userService.reactivateAccount(req.user.userId);
            const response = {
                success: true,
                message: 'Account reactivated successfully',
                data: { user },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Search users
     */
    async searchUsers(req, res, next) {
        try {
            const { error, value } = user_validation_1.searchUsersSchema.validate(req.query);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const result = await user_service_1.userService.searchUsers(value.query, value.page, value.limit);
            const response = {
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
                message: ''
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user stats
     */
    async getStats(req, res, next) {
        try {
            const stats = await user_service_1.userService.getUserStats(req.user.userId);
            const response = {
                success: true,
                data: { stats },
                timestamp: new Date().toISOString(),
                message: ''
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get linked accounts
     */
    async getLinkedAccounts(req, res, next) {
        try {
            const linkedAccounts = await user_service_1.userService.getLinkedAccounts(req.user.userId);
            const response = {
                success: true,
                data: { linkedAccounts },
                timestamp: new Date().toISOString(),
                message: ''
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Upgrade user role (admin only)
     */
    async upgradeRole(req, res, next) {
        try {
            const { userId } = req.params;
            const { error, value } = user_validation_1.upgradeRoleSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            // Only admin can upgrade roles
            if (req.user?.role !== 'admin') {
                throw new AppError_1.ForbiddenError('Only administrators can upgrade user roles');
            }
            const user = await user_service_1.userService.upgradeRole(userId, value.role);
            const response = {
                success: true,
                message: `User role upgraded to ${value.role}`,
                data: { user },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UserController = UserController;
exports.userController = new UserController();
//# sourceMappingURL=user.controller.js.map
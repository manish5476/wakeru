"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.UserController = void 0;
const user_service_1 = require("./user.service");
const AppError_1 = require("../../shared/errors/AppError");
class UserController {
    async getProfile(req, res, next) {
        try {
            const user = await user_service_1.userService.getUserById(req.user.userId);
            res.status(200).json({
                success: true,
                data: { user: user.toFullProfile() },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getPublicProfile(req, res, next) {
        try {
            const user = await user_service_1.userService.getPublicProfile(req.params.userId);
            res.status(200).json({
                success: true,
                data: { user },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async updateProfile(req, res, next) {
        try {
            const user = await user_service_1.userService.updateProfile(req.user.userId, req.body);
            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: { user: user.toFullProfile() },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async updatePreferences(req, res, next) {
        try {
            const user = await user_service_1.userService.updatePreferences(req.user.userId, req.body);
            res.status(200).json({
                success: true,
                message: 'Preferences updated successfully',
                data: { user: user.toFullProfile() },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async updateBankingDetails(req, res, next) {
        try {
            const user = await user_service_1.userService.updateBankingDetails(req.user.userId, req.body);
            res.status(200).json({
                success: true,
                message: 'Banking details updated successfully',
                data: { user: user.toFullProfile() },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async uploadProfilePicture(req, res, next) {
        try {
            if (!req.file)
                throw new AppError_1.NotFoundError('No file uploaded');
            const photoURL = await user_service_1.userService.uploadProfilePicture(req.user.userId, req.file);
            res.status(200).json({
                success: true,
                message: 'Profile picture uploaded successfully',
                data: { photoURL },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async deleteAccount(req, res, next) {
        try {
            await user_service_1.userService.deleteAccount(req.user.userId);
            res.status(200).json({
                success: true,
                message: 'Account deleted successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async deactivateAccount(req, res, next) {
        try {
            await user_service_1.userService.deactivateAccount(req.user.userId);
            res.status(200).json({
                success: true,
                message: 'Account deactivated successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async reactivateAccount(req, res, next) {
        try {
            await user_service_1.userService.reactivateAccount(req.user.userId);
            res.status(200).json({
                success: true,
                message: 'Account reactivated successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async searchUsers(req, res, next) {
        try {
            const { query, page, limit } = req.query;
            const result = await user_service_1.userService.searchUsers(query, page, limit);
            res.status(200).json({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getStats(req, res, next) {
        try {
            const stats = await user_service_1.userService.getUserStats(req.user.userId);
            res.status(200).json({
                success: true,
                data: { stats },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getLinkedAccounts(req, res, next) {
        try {
            const linkedAccounts = await user_service_1.userService.getLinkedAccounts(req.user.userId);
            res.status(200).json({
                success: true,
                data: { linkedAccounts },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async upgradeRole(req, res, next) {
        try {
            if (req.user?.role !== 'admin') {
                throw new AppError_1.ForbiddenError('Only administrators can upgrade user roles');
            }
            const user = await user_service_1.userService.upgradeRole(req.params.userId, req.body.role);
            res.status(200).json({
                success: true,
                message: `User role upgraded to ${req.body.role}`,
                data: { user: user.toFullProfile() },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UserController = UserController;
exports.userController = new UserController();
//# sourceMappingURL=user.controller.js.map
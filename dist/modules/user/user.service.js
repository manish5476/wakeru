"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const auth_model_1 = require("../auth/auth.model");
const AppError_1 = require("../../shared/errors/AppError");
const logger_1 = require("../../config/logger");
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("../../config");
const constants_1 = require("../../config/constants");
class UserService {
    /**
     * Get user by ID (with cache)
     */
    async getUserById(userId) {
        const user = await auth_model_1.User.findActive(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        return user;
    }
    /**
     * Get public profile
     */
    async getPublicProfile(userId) {
        const user = await auth_model_1.User.findActive(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        return user.toPublicProfile();
    }
    /**
     * Update profile
     */
    async updateProfile(userId, updateData) {
        if (updateData.phoneNumber) {
            const existing = await auth_model_1.User.findOne({
                phoneNumber: updateData.phoneNumber,
                _id: { $ne: userId },
                isDeleted: false,
            });
            if (existing) {
                throw new AppError_1.ConflictError('Phone number already in use');
            }
        }
        const allowedFields = ['displayName', 'photoURL', 'bio', 'phoneNumber'];
        const sanitized = {};
        for (const key of allowedFields) {
            if (updateData[key] !== undefined) {
                sanitized[key] = updateData[key];
            }
        }
        const user = await auth_model_1.User.findOneAndUpdate({ _id: userId, isDeleted: false }, { $set: sanitized }, { new: true, runValidators: true });
        if (!user)
            throw new AppError_1.NotFoundError('User');
        logger_1.logger.info(`Profile updated: ${userId}`);
        return user;
    }
    /**
     * Update preferences
     */
    async updatePreferences(userId, preferences) {
        if (preferences.defaultCurrency) {
            const valid = Object.keys(constants_1.CONSTANTS.CURRENCIES);
            if (!valid.includes(preferences.defaultCurrency)) {
                throw new AppError_1.BadRequestError(`Invalid currency. Must be one of: ${valid.join(', ')}`);
            }
        }
        const updateData = {};
        for (const [key, value] of Object.entries(preferences)) {
            updateData[`preferences.${key}`] = value;
        }
        const user = await auth_model_1.User.findOneAndUpdate({ _id: userId, isDeleted: false }, { $set: updateData }, { new: true, runValidators: true });
        if (!user)
            throw new AppError_1.NotFoundError('User');
        logger_1.logger.info(`Preferences updated: ${userId}`);
        return user;
    }
    /**
     * Update banking details
     */
    async updateBankingDetails(userId, bankingDetails) {
        if (bankingDetails.upiId) {
            const upiRegex = /^[\w.-]+@[\w]+$/;
            if (!upiRegex.test(bankingDetails.upiId)) {
                throw new AppError_1.BadRequestError('Invalid UPI ID format (e.g., name@upi)');
            }
        }
        const updateData = {};
        for (const [key, value] of Object.entries(bankingDetails)) {
            updateData[`bankingDetails.${key}`] = value;
        }
        if (bankingDetails.upiId) {
            updateData['bankingDetails.upiVerified'] = false; // Reset on change
        }
        const user = await auth_model_1.User.findOneAndUpdate({ _id: userId, isDeleted: false }, { $set: updateData }, { new: true, runValidators: true });
        if (!user)
            throw new AppError_1.NotFoundError('User');
        logger_1.logger.info(`Banking details updated: ${userId}`);
        return user;
    }
    /**
     * Upload profile picture
     */
    async uploadProfilePicture(userId, file) {
        const allowedTypes = constants_1.CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes;
        if (!allowedTypes.includes(file.mimetype)) {
            throw new AppError_1.BadRequestError('Invalid file type. Allowed: JPEG, PNG');
        }
        if (file.size > constants_1.CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize) {
            throw new AppError_1.BadRequestError('File too large. Maximum 5MB');
        }
        const filename = `profile-${userId}-${Date.now()}.webp`;
        const uploadDir = path_1.default.join(config_1.config.UPLOAD_DIR, 'profiles');
        await promises_1.default.mkdir(uploadDir, { recursive: true });
        const outputPath = path_1.default.join(uploadDir, filename);
        await (0, sharp_1.default)(file.buffer)
            .resize(400, 400, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(outputPath);
        const photoURL = `/uploads/profiles/${filename}`;
        await auth_model_1.User.findOneAndUpdate({ _id: userId }, { $set: { photoURL } });
        logger_1.logger.info(`Profile picture uploaded: ${userId}`);
        return photoURL;
    }
    /**
     * Delete account (soft delete)
     */
    async deleteAccount(userId) {
        await auth_model_1.User.findOneAndUpdate({ _id: userId }, {
            $set: {
                isDeleted: true,
                isActive: false,
                deletedAt: new Date(),
                refreshTokens: [],
                fcmToken: null,
            }
        });
        logger_1.logger.info(`Account deleted: ${userId}`);
    }
    /**
     * Deactivate account
     */
    async deactivateAccount(userId) {
        const user = await auth_model_1.User.findOneAndUpdate({ _id: userId, isDeleted: false }, { $set: { isActive: false } }, { new: true });
        if (!user)
            throw new AppError_1.NotFoundError('User');
        logger_1.logger.info(`Account deactivated: ${userId}`);
        return user;
    }
    /**
     * Reactivate account
     */
    async reactivateAccount(userId) {
        const user = await auth_model_1.User.findOneAndUpdate({ _id: userId }, { $set: { isActive: true, isDeleted: false, deletedAt: null } }, { new: true });
        if (!user)
            throw new AppError_1.NotFoundError('User');
        logger_1.logger.info(`Account reactivated: ${userId}`);
        return user;
    }
    /**
     * Search users
     */
    async searchUsers(query, page = 1, limit = 10) {
        const searchRegex = new RegExp(query, 'i');
        const users = await auth_model_1.User.find({
            isDeleted: false,
            isActive: true,
            $or: [
                { email: searchRegex },
                { displayName: searchRegex },
                { phoneNumber: searchRegex },
            ],
        })
            .select('_id email displayName photoURL')
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        const total = await auth_model_1.User.countDocuments({
            isDeleted: false,
            isActive: true,
            $or: [
                { email: searchRegex },
                { displayName: searchRegex },
                { phoneNumber: searchRegex },
            ],
        });
        return { users: users, total, page, limit };
    }
    /**
     * Get user stats
     */
    async getUserStats(userId) {
        const user = await auth_model_1.User.findActive(userId);
        if (!user)
            throw new AppError_1.NotFoundError('User');
        return {
            totalGroups: user.stats.totalGroups,
            totalExpenses: user.stats.totalExpenses,
            totalSettled: user.stats.totalSettled,
            totalPending: user.stats.totalPending,
            totalOwedAcrossTrips: user.totalOwedAcrossTrips,
            totalLentAcrossTrips: user.totalLentAcrossTrips,
            netBalance: user.totalLentAcrossTrips - user.totalOwedAcrossTrips,
            lastActiveAt: user.stats.lastActiveAt,
            memberSince: user.stats.accountCreatedAt,
            role: user.role,
        };
    }
    /**
     * Get linked accounts
     */
    async getLinkedAccounts(userId) {
        const user = await auth_model_1.User.findActive(userId);
        if (!user)
            throw new AppError_1.NotFoundError('User');
        const linked = {};
        if (user.authProviders?.google) {
            linked.google = { email: user.authProviders.google.email, linked: true };
        }
        if (user.authProviders?.apple) {
            linked.apple = { email: user.authProviders.apple.email, linked: true };
        }
        linked.email = {
            email: user.email,
            verified: user.authProviders?.email?.verified || false,
        };
        return linked;
    }
    /**
     * Upgrade user role (admin only)
     */
    async upgradeRole(userId, newRole) {
        const user = await auth_model_1.User.findOneAndUpdate({ _id: userId, isDeleted: false }, { $set: { role: newRole } }, { new: true, runValidators: true });
        if (!user)
            throw new AppError_1.NotFoundError('User');
        logger_1.logger.info(`Role upgraded: ${userId} → ${newRole}`);
        return user;
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
//# sourceMappingURL=user.service.js.map
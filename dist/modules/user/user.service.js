"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const user_repository_1 = require("./user.repository");
const AppError_1 = require("../../shared/errors/AppError");
const logger_1 = require("../../config/logger");
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("../../config");
const redis_1 = require("../../config/redis");
const constants_1 = require("../../config/constants");
class UserService {
    /**
     * Get user by ID
     */
    async getUserById(userId) {
        // Try cache first
        const cacheKey = `user:${userId}`;
        const cached = await redis_1.redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        const user = await user_repository_1.userRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        // Cache for 1 hour
        await redis_1.redisClient.set(cacheKey, JSON.stringify(user), constants_1.CONSTANTS.CACHE_TTL.USER_PROFILE);
        return user;
    }
    /**
     * Update user profile
     */
    async updateProfile(userId, updateData) {
        // Check if email is being changed and if it's available
        if (updateData.phoneNumber) {
            const existingUser = await user_repository_1.userRepository.findByPhone(updateData.phoneNumber);
            if (existingUser && existingUser.userId !== userId) {
                throw new AppError_1.ConflictError('Phone number already in use');
            }
        }
        const updatedUser = await user_repository_1.userRepository.updateUser(userId, updateData);
        if (!updatedUser) {
            throw new AppError_1.NotFoundError('User');
        }
        // Invalidate cache
        await redis_1.redisClient.delete(`user:${userId}`);
        logger_1.logger.info(`User profile updated: ${userId}`);
        return updatedUser;
    }
    /**
     * Update user preferences
     */
    async updatePreferences(userId, preferences) {
        // Validate currency
        if (preferences.defaultCurrency && !constants_1.CONSTANTS.CURRENCIES[preferences.defaultCurrency]) {
            throw new AppError_1.BadRequestError('Invalid currency');
        }
        const updatedUser = await user_repository_1.userRepository.updatePreferences(userId, preferences);
        if (!updatedUser) {
            throw new AppError_1.NotFoundError('User');
        }
        await redis_1.redisClient.delete(`user:${userId}`);
        logger_1.logger.info(`User preferences updated: ${userId}`);
        return updatedUser;
    }
    /**
     * Update banking details
     */
    async updateBankingDetails(userId, bankingDetails) {
        // Validate UPI ID format
        if (bankingDetails.upiId) {
            const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
            if (!upiRegex.test(bankingDetails.upiId)) {
                throw new AppError_1.BadRequestError('Invalid UPI ID format');
            }
        }
        // Validate bank account
        if (bankingDetails.bankAccount) {
            if (!bankingDetails.bankAccount.accountNumber || !bankingDetails.bankAccount.ifscCode) {
                throw new AppError_1.BadRequestError('Account number and IFSC code are required');
            }
            // Validate IFSC format
            const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
            if (!ifscRegex.test(bankingDetails.bankAccount.ifscCode)) {
                throw new AppError_1.BadRequestError('Invalid IFSC code format');
            }
        }
        const updatedUser = await user_repository_1.userRepository.updateBankingDetails(userId, bankingDetails);
        if (!updatedUser) {
            throw new AppError_1.NotFoundError('User');
        }
        await redis_1.redisClient.delete(`user:${userId}`);
        logger_1.logger.info(`Banking details updated: ${userId}`);
        return updatedUser;
    }
    /**
     * Upload profile picture
     */
    async uploadProfilePicture(userId, file) {
        // Validate file type
        const allowedTypes = constants_1.CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes;
        if (!allowedTypes.includes(file.mimetype)) {
            throw new AppError_1.BadRequestError('Invalid file type. Allowed: JPEG, PNG');
        }
        // Validate file size
        if (file.size > constants_1.CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize) {
            throw new AppError_1.BadRequestError('File too large. Maximum 5MB');
        }
        try {
            // Process image with sharp
            const filename = `profile-${userId}-${Date.now()}.webp`;
            const uploadDir = path_1.default.join(config_1.config.UPLOAD_DIR, 'profiles');
            await promises_1.default.mkdir(uploadDir, { recursive: true });
            const outputPath = path_1.default.join(uploadDir, filename);
            await (0, sharp_1.default)(file.buffer)
                .resize(400, 400, { fit: 'cover' })
                .webp({ quality: 80 })
                .toFile(outputPath);
            // Update user profile picture URL
            const profilePictureUrl = `/uploads/profiles/${filename}`;
            await user_repository_1.userRepository.updateProfilePicture(userId, profilePictureUrl);
            // Invalidate cache
            await redis_1.redisClient.delete(`user:${userId}`);
            logger_1.logger.info(`Profile picture uploaded: ${userId}`);
            return profilePictureUrl;
        }
        catch (error) {
            logger_1.logger.error('Profile picture upload failed:', error);
            throw new AppError_1.BadRequestError('Failed to upload profile picture');
        }
    }
    /**
     * Delete account (soft delete)
     */
    async deleteAccount(userId) {
        await user_repository_1.userRepository.softDelete(userId);
        await redis_1.redisClient.delete(`user:${userId}`);
        logger_1.logger.info(`Account deleted: ${userId}`);
    }
    /**
     * Deactivate account
     */
    async deactivateAccount(userId) {
        const user = await user_repository_1.userRepository.deactivateAccount(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        await redis_1.redisClient.delete(`user:${userId}`);
        logger_1.logger.info(`Account deactivated: ${userId}`);
        return user;
    }
    /**
     * Reactivate account
     */
    async reactivateAccount(userId) {
        const user = await user_repository_1.userRepository.reactivateAccount(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        await redis_1.redisClient.delete(`user:${userId}`);
        logger_1.logger.info(`Account reactivated: ${userId}`);
        return user;
    }
    /**
     * Search users
     */
    async searchUsers(query, page = 1, limit = 10) {
        if (!query || query.length < 2) {
            throw new AppError_1.BadRequestError('Search query must be at least 2 characters');
        }
        const users = await user_repository_1.userRepository.searchUsers(query, limit);
        return {
            users,
            total: users.length
        };
    }
    /**
     * Get user stats
     */
    async getUserStats(userId) {
        const user = await user_repository_1.userRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        return {
            totalGroups: user.stats.totalGroups,
            totalExpenses: user.stats.totalExpenses,
            totalSettled: user.stats.totalSettled,
            totalPending: user.stats.totalPending,
            lastActiveAt: user.stats.lastActiveAt,
            memberSince: user.stats.accountCreatedAt,
            role: user.role,
            isVerified: user.isVerified
        };
    }
    /**
     * Get user's public profile
     */
    async getPublicProfile(userId) {
        const user = await user_repository_1.userRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        return {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName,
            profilePicture: user.profilePicture,
            preferences: {
                defaultCurrency: user.preferences.defaultCurrency,
                language: user.preferences.language,
                theme: user.preferences.theme,
                timezone: user.preferences.timezone,
                notificationPreferences: user.preferences.notificationPreferences
            }
        };
    }
    /**
     * Upgrade user role
     */
    async upgradeRole(userId, newRole) {
        const validRoles = ['user', 'premium', 'business', 'admin'];
        if (!validRoles.includes(newRole)) {
            throw new AppError_1.BadRequestError('Invalid role');
        }
        const user = await user_repository_1.userRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        user.role = newRole;
        await user.save();
        await redis_1.redisClient.delete(`user:${userId}`);
        logger_1.logger.info(`User role upgraded: ${userId} to ${newRole}`);
        return user;
    }
    /**
     * Get user's linked accounts
     */
    async getLinkedAccounts(userId) {
        const user = await user_repository_1.userRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        const linkedAccounts = {};
        if (user.authProviders.google) {
            linkedAccounts.google = {
                email: user.authProviders.google.email,
                linked: true
            };
        }
        if (user.authProviders.apple) {
            linkedAccounts.apple = {
                email: user.authProviders.apple.email,
                linked: true
            };
        }
        linkedAccounts.email = {
            email: user.email,
            verified: user.authProviders.email?.verified || false
        };
        return linkedAccounts;
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
//# sourceMappingURL=user.service.js.map
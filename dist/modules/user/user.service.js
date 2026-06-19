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
        return { users, total, page, limit };
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
// import { userRepository } from './user.repository';
// import { IUserDocument } from './user.model';
// import { UpdateUserDTO } from '../../shared/types/user.types';
// import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/AppError';
// import { logger } from '../../config/logger';
// import sharp from 'sharp';
// import path from 'path';
// import fs from 'fs/promises';
// import { config } from '../../config';
// import { redisClient } from '../../config/redis';
// import { CONSTANTS } from '../../config/constants';
// export class UserService {
//   /**
//    * Get user by ID
//    */
//   async getUserById(userId: string): Promise<IUserDocument> {
//     // Try cache first
//     const cacheKey = `user:${userId}`;
//     const cached = await redisClient.get(cacheKey);
//     if (cached) {
//       return JSON.parse(cached);
//     }
//     const user = await userRepository.findById(userId);
//     if (!user) {
//       throw new NotFoundError('User');
//     }
//     // Cache for 1 hour
//     await redisClient.set(cacheKey, JSON.stringify(user), CONSTANTS.CACHE_TTL.USER_PROFILE);
//     return user;
//   }
//   /**
//    * Update user profile
//    */
//   async updateProfile(userId: string, updateData: UpdateUserDTO): Promise<IUserDocument> {
//     // Check if email is being changed and if it's available
//     if (updateData.phoneNumber) {
//       const existingUser = await userRepository.findByPhone(updateData.phoneNumber);
//       if (existingUser && existingUser.userId !== userId) {
//         throw new ConflictError('Phone number already in use');
//       }
//     }
//     const updatedUser = await userRepository.updateUser(userId, updateData);
//     if (!updatedUser) {
//       throw new NotFoundError('User');
//     }
//     // Invalidate cache
//     await redisClient.delete(`user:${userId}`);
//     logger.info(`User profile updated: ${userId}`);
//     return updatedUser;
//   }
//   /**
//    * Update user preferences
//    */
//   async updatePreferences(userId: string, preferences: any): Promise<IUserDocument> {
//     // Validate currency
//     if (preferences.defaultCurrency && !CONSTANTS.CURRENCIES[preferences.defaultCurrency as keyof typeof CONSTANTS.CURRENCIES]) {
//       throw new BadRequestError('Invalid currency');
//     }
//     const updatedUser = await userRepository.updatePreferences(userId, preferences);
//     if (!updatedUser) {
//       throw new NotFoundError('User');
//     }
//     await redisClient.delete(`user:${userId}`);
//     logger.info(`User preferences updated: ${userId}`);
//     return updatedUser;
//   }
//   /**
//    * Update banking details
//    */
//   async updateBankingDetails(userId: string, bankingDetails: any): Promise<IUserDocument> {
//     // Validate UPI ID format
//     if (bankingDetails.upiId) {
//       const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
//       if (!upiRegex.test(bankingDetails.upiId)) {
//         throw new BadRequestError('Invalid UPI ID format');
//       }
//     }
//     // Validate bank account
//     if (bankingDetails.bankAccount) {
//       if (!bankingDetails.bankAccount.accountNumber || !bankingDetails.bankAccount.ifscCode) {
//         throw new BadRequestError('Account number and IFSC code are required');
//       }
//       // Validate IFSC format
//       const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
//       if (!ifscRegex.test(bankingDetails.bankAccount.ifscCode)) {
//         throw new BadRequestError('Invalid IFSC code format');
//       }
//     }
//     const updatedUser = await userRepository.updateBankingDetails(userId, bankingDetails);
//     if (!updatedUser) {
//       throw new NotFoundError('User');
//     }
//     await redisClient.delete(`user:${userId}`);
//     logger.info(`Banking details updated: ${userId}`);
//     return updatedUser;
//   }
//   /**
//    * Upload profile picture
//    */
//   async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string> {
//     // Validate file type
//     const allowedTypes = CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes;
//     if (!(allowedTypes as readonly string[]).includes(file.mimetype)) {
//       throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG');
//     }
//     // Validate file size
//     if (file.size > CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize) {
//       throw new BadRequestError('File too large. Maximum 5MB');
//     }
//     try {
//       // Process image with sharp
//       const filename = `profile-${userId}-${Date.now()}.webp`;
//       const uploadDir = path.join(config.UPLOAD_DIR, 'profiles');
//       await fs.mkdir(uploadDir, { recursive: true });
//       const outputPath = path.join(uploadDir, filename);
//       await sharp(file.buffer)
//         .resize(400, 400, { fit: 'cover' })
//         .webp({ quality: 80 })
//         .toFile(outputPath);
//       // Update user profile picture URL
//       const profilePictureUrl = `/uploads/profiles/${filename}`;
//       await userRepository.updateProfilePicture(userId, profilePictureUrl);
//       // Invalidate cache
//       await redisClient.delete(`user:${userId}`);
//       logger.info(`Profile picture uploaded: ${userId}`);
//       return profilePictureUrl;
//     } catch (error) {
//       logger.error('Profile picture upload failed:', error);
//       throw new BadRequestError('Failed to upload profile picture');
//     }
//   }
//   /**
//    * Delete account (soft delete)
//    */
//   async deleteAccount(userId: string): Promise<void> {
//     await userRepository.softDelete(userId);
//     await redisClient.delete(`user:${userId}`);
//     logger.info(`Account deleted: ${userId}`);
//   }
//   /**
//    * Deactivate account
//    */
//   async deactivateAccount(userId: string): Promise<IUserDocument> {
//     const user = await userRepository.deactivateAccount(userId);
//     if (!user) {
//       throw new NotFoundError('User');
//     }
//     await redisClient.delete(`user:${userId}`);
//     logger.info(`Account deactivated: ${userId}`);
//     return user;
//   }
//   /**
//    * Reactivate account
//    */
//   async reactivateAccount(userId: string): Promise<IUserDocument> {
//     const user = await userRepository.reactivateAccount(userId);
//     if (!user) {
//       throw new NotFoundError('User');
//     }
//     await redisClient.delete(`user:${userId}`);
//     logger.info(`Account reactivated: ${userId}`);
//     return user;
//   }
//   /**
//    * Search users
//    */
//   async searchUsers(query: string, page: number = 1, limit: number = 10): Promise<{ users: IUserDocument[]; total: number }> {
//     if (!query || query.length < 2) {
//       throw new BadRequestError('Search query must be at least 2 characters');
//     }
//     const users = await userRepository.searchUsers(query, limit);
//     return {
//       users,
//       total: users.length
//     };
//   }
//   /**
//    * Get user stats
//    */
//   async getUserStats(userId: string): Promise<any> {
//     const user = await userRepository.findById(userId);
//     if (!user) {
//       throw new NotFoundError('User');
//     }
//     return {
//       totalGroups: user.stats.totalGroups,
//       totalExpenses: user.stats.totalExpenses,
//       totalSettled: user.stats.totalSettled,
//       totalPending: user.stats.totalPending,
//       lastActiveAt: user.stats.lastActiveAt,
//       memberSince: user.stats.accountCreatedAt,
//       role: user.role,
//       isVerified: user.isVerified
//     };
//   }
//   /**
//    * Get user's public profile
//    */
//   async getPublicProfile(userId: string): Promise<Partial<IUserDocument>> {
//     const user = await userRepository.findById(userId);
//     if (!user) {
//       throw new NotFoundError('User');
//     }
//     return {
//       userId: user.userId,
//       firstName: user.firstName,
//       lastName: user.lastName,
//       displayName: user.displayName,
//       profilePicture: user.profilePicture,
//       preferences: {
//         defaultCurrency: user.preferences.defaultCurrency,
//         language: user.preferences.language,
//         theme: user.preferences.theme,
//         timezone: user.preferences.timezone,
//         notificationPreferences: user.preferences.notificationPreferences
//       }
//     };
//   }
//   /**
//    * Upgrade user role
//    */
//   async upgradeRole(userId: string, newRole: string): Promise<IUserDocument> {
//     const validRoles = ['user', 'premium', 'business', 'admin'];
//     if (!validRoles.includes(newRole)) {
//       throw new BadRequestError('Invalid role');
//     }
//     const user = await userRepository.findById(userId);
//     if (!user) {
//       throw new NotFoundError('User');
//     }
//     user.role = newRole as any;
//     await user.save();
//     await redisClient.delete(`user:${userId}`);
//     logger.info(`User role upgraded: ${userId} to ${newRole}`);
//     return user;
//   }
//   /**
//    * Get user's linked accounts
//    */
//   async getLinkedAccounts(userId: string): Promise<any> {
//     const user = await userRepository.findById(userId);
//     if (!user) {
//       throw new NotFoundError('User');
//     }
//     const linkedAccounts: any = {};
//     if (user.authProviders.google) {
//       linkedAccounts.google = {
//         email: user.authProviders.google.email,
//         linked: true
//       };
//     }
//     if (user.authProviders.apple) {
//       linkedAccounts.apple = {
//         email: user.authProviders.apple.email,
//         linked: true
//       };
//     }
//     linkedAccounts.email = {
//       email: user.email,
//       verified: user.authProviders.email?.verified || false
//     };
//     return linkedAccounts;
//   }
// }
// export const userService = new UserService();
//# sourceMappingURL=user.service.js.map
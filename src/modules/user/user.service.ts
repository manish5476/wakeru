import { userRepository } from './user.repository';
import { IUserDocument } from './user.model';
import { UpdateUserDTO } from '../../shared/types/user.types';
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../../config';
import { redisClient } from '../../config/redis';
import { CONSTANTS } from '../../config/constants';

export class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUserDocument> {
    // Try cache first
    const cacheKey = `user:${userId}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Cache for 1 hour
    await redisClient.set(cacheKey, JSON.stringify(user), CONSTANTS.CACHE_TTL.USER_PROFILE);

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateData: UpdateUserDTO): Promise<IUserDocument> {
    // Check if email is being changed and if it's available
    if (updateData.phoneNumber) {
      const existingUser = await userRepository.findByPhone(updateData.phoneNumber);
      if (existingUser && existingUser.userId !== userId) {
        throw new ConflictError('Phone number already in use');
      }
    }

    const updatedUser = await userRepository.updateUser(userId, updateData);
    if (!updatedUser) {
      throw new NotFoundError('User');
    }

    // Invalidate cache
    await redisClient.delete(`user:${userId}`);

    logger.info(`User profile updated: ${userId}`);
    return updatedUser;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: any): Promise<IUserDocument> {
    // Validate currency
    if (preferences.defaultCurrency && !CONSTANTS.CURRENCIES[preferences.defaultCurrency as keyof typeof CONSTANTS.CURRENCIES]) {
      throw new BadRequestError('Invalid currency');
    }

    const updatedUser = await userRepository.updatePreferences(userId, preferences);
    if (!updatedUser) {
      throw new NotFoundError('User');
    }

    await redisClient.delete(`user:${userId}`);

    logger.info(`User preferences updated: ${userId}`);
    return updatedUser;
  }

  /**
   * Update banking details
   */
  async updateBankingDetails(userId: string, bankingDetails: any): Promise<IUserDocument> {
    // Validate UPI ID format
    if (bankingDetails.upiId) {
      const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
      if (!upiRegex.test(bankingDetails.upiId)) {
        throw new BadRequestError('Invalid UPI ID format');
      }
    }

    // Validate bank account
    if (bankingDetails.bankAccount) {
      if (!bankingDetails.bankAccount.accountNumber || !bankingDetails.bankAccount.ifscCode) {
        throw new BadRequestError('Account number and IFSC code are required');
      }

      // Validate IFSC format
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(bankingDetails.bankAccount.ifscCode)) {
        throw new BadRequestError('Invalid IFSC code format');
      }
    }

    const updatedUser = await userRepository.updateBankingDetails(userId, bankingDetails);
    if (!updatedUser) {
      throw new NotFoundError('User');
    }

    await redisClient.delete(`user:${userId}`);

    logger.info(`Banking details updated: ${userId}`);
    return updatedUser;
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string> {
    // Validate file type
    const allowedTypes = CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes;
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG');
    }

    // Validate file size
    if (file.size > CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize) {
      throw new BadRequestError('File too large. Maximum 5MB');
    }

    try {
      // Process image with sharp
      const filename = `profile-${userId}-${Date.now()}.webp`;
      const uploadDir = path.join(config.UPLOAD_DIR, 'profiles');
      
      await fs.mkdir(uploadDir, { recursive: true });

      const outputPath = path.join(uploadDir, filename);

      await sharp(file.buffer)
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(outputPath);

      // Update user profile picture URL
      const profilePictureUrl = `/uploads/profiles/${filename}`;
      await userRepository.updateProfilePicture(userId, profilePictureUrl);
      
      // Invalidate cache
      await redisClient.delete(`user:${userId}`);

      logger.info(`Profile picture uploaded: ${userId}`);
      return profilePictureUrl;
    } catch (error) {
      logger.error('Profile picture upload failed:', error);
      throw new BadRequestError('Failed to upload profile picture');
    }
  }

  /**
   * Delete account (soft delete)
   */
  async deleteAccount(userId: string): Promise<void> {
    await userRepository.softDelete(userId);
    await redisClient.delete(`user:${userId}`);
    logger.info(`Account deleted: ${userId}`);
  }

  /**
   * Deactivate account
   */
  async deactivateAccount(userId: string): Promise<IUserDocument> {
    const user = await userRepository.deactivateAccount(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    await redisClient.delete(`user:${userId}`);
    logger.info(`Account deactivated: ${userId}`);
    return user;
  }

  /**
   * Reactivate account
   */
  async reactivateAccount(userId: string): Promise<IUserDocument> {
    const user = await userRepository.reactivateAccount(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    await redisClient.delete(`user:${userId}`);
    logger.info(`Account reactivated: ${userId}`);
    return user;
  }

  /**
   * Search users
   */
  async searchUsers(query: string, page: number = 1, limit: number = 10): Promise<{ users: IUserDocument[]; total: number }> {
    if (!query || query.length < 2) {
      throw new BadRequestError('Search query must be at least 2 characters');
    }

    const users = await userRepository.searchUsers(query, limit);
    
    return {
      users,
      total: users.length
    };
  }

  /**
   * Get user stats
   */
  async getUserStats(userId: string): Promise<any> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
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
  async getPublicProfile(userId: string): Promise<Partial<IUserDocument>> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
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
  async upgradeRole(userId: string, newRole: string): Promise<IUserDocument> {
    const validRoles = ['user', 'premium', 'business', 'admin'];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestError('Invalid role');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    user.role = newRole as any;
    await user.save();

    await redisClient.delete(`user:${userId}`);
    logger.info(`User role upgraded: ${userId} to ${newRole}`);
    return user;
  }

  /**
   * Get user's linked accounts
   */
  async getLinkedAccounts(userId: string): Promise<any> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const linkedAccounts: any = {};

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

export const userService = new UserService();
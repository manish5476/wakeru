import { User, IUserDocument } from '../auth/auth.model';
import { getAuth } from 'firebase-admin/auth';
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../../config';
import { CONSTANTS } from '../../config/constants';

interface PaginatedUserSearchResult {
  users: Partial<IUserDocument>[];
  total: number;
  page: number;
  limit: number;
}

export class UserService {
  
  /**
   * Get user by ID (with cache)
   */
  async getUserById(userId: string): Promise<IUserDocument> {
    const user = await User.findActive(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  /**
   * Get public profile
   */
  async getPublicProfile(userId: string): Promise<Record<string, any>> {
    const user = await User.findActive(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user.toPublicProfile();
  }

  /**
   * Update profile
   */
  async updateProfile(userId: string, updateData: Record<string, any>): Promise<IUserDocument> {
    if (updateData.phoneNumber) {
      const existing = await User.findOne({ 
        phoneNumber: updateData.phoneNumber, 
        _id: { $ne: userId },
        isDeleted: false,
      });
      if (existing) {
        throw new ConflictError('Phone number already in use');
      }
    }

    const allowedFields = ['displayName', 'photoURL', 'bio', 'phoneNumber'];
    const sanitized: Record<string, any> = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        sanitized[key] = updateData[key];
      }
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $set: sanitized },
      { new: true, runValidators: true }
    );

    if (!user) throw new NotFoundError('User');
    logger.info(`Profile updated: ${userId}`);
    return user;
  }

  /**
   * Update preferences
   */
  async updatePreferences(userId: string, preferences: Record<string, any>): Promise<IUserDocument> {
    if (preferences.defaultCurrency) {
      const valid = Object.keys(CONSTANTS.CURRENCIES);
      if (!valid.includes(preferences.defaultCurrency)) {
        throw new BadRequestError(`Invalid currency. Must be one of: ${valid.join(', ')}`);
      }
    }

    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(preferences)) {
      updateData[`preferences.${key}`] = value;
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) throw new NotFoundError('User');
    logger.info(`Preferences updated: ${userId}`);
    return user;
  }

  /**
   * Update banking details
   */
  async updateBankingDetails(userId: string, bankingDetails: Record<string, any>): Promise<IUserDocument> {
    if (bankingDetails.upiId) {
      const upiRegex = /^[\w.-]+@[\w]+$/;
      if (!upiRegex.test(bankingDetails.upiId)) {
        throw new BadRequestError('Invalid UPI ID format (e.g., name@upi)');
      }
    }

    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(bankingDetails)) {
      updateData[`bankingDetails.${key}`] = value;
    }
    if (bankingDetails.upiId) {
      updateData['bankingDetails.upiVerified'] = false; // Reset on change
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) throw new NotFoundError('User');
    logger.info(`Banking details updated: ${userId}`);
    return user;
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string> {
    const allowedTypes = CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes as readonly string[];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG');
    }

    if (file.size > CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize) {
      throw new BadRequestError('File too large. Maximum 5MB');
    }

    const filename = `profile-${userId}-${Date.now()}.webp`;
    const uploadDir = path.join(config.UPLOAD_DIR, 'profiles');
    await fs.mkdir(uploadDir, { recursive: true });

    const outputPath = path.join(uploadDir, filename);
    await sharp(file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(outputPath);

    const photoURL = `/uploads/profiles/${filename}`;
    await User.findOneAndUpdate(
      { _id: userId },
      { $set: { photoURL } }
    );

    logger.info(`Profile picture uploaded: ${userId}`);
    return photoURL;
  }

  /**
   * Delete account (soft delete and remove from Firebase)
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await User.findOneAndUpdate(
      { _id: userId },
      { 
        $set: { 
          isDeleted: true, 
          isActive: false, 
          deletedAt: new Date(),
          refreshTokens: [],
          fcmToken: null,
        } 
      }
    );

    if (user && user.firebaseUid) {
      try {
        await getAuth().deleteUser(user.firebaseUid);
        logger.info(`Firebase user deleted: ${user.firebaseUid}`);
      } catch (error: any) {
        logger.error(`Failed to delete Firebase user: ${user.firebaseUid}`, error);
      }
    }

    logger.info(`Account deleted: ${userId}`);
  }

  /**
   * Deactivate account
   */
  async deactivateAccount(userId: string): Promise<IUserDocument> {
    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!user) throw new NotFoundError('User');
    logger.info(`Account deactivated: ${userId}`);
    return user;
  }

  /**
   * Reactivate account
   */
  async reactivateAccount(userId: string): Promise<IUserDocument> {
    const user = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { isActive: true, isDeleted: false, deletedAt: null } },
      { new: true }
    );
    if (!user) throw new NotFoundError('User');
    logger.info(`Account reactivated: ${userId}`);
    return user;
  }

  /**
   * Search users
   */
  async searchUsers(query: string, page: number = 1, limit: number = 10): Promise<PaginatedUserSearchResult> {
    const searchRegex = new RegExp(query, 'i');
    const users = await User.find({
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

    const total = await User.countDocuments({
      isDeleted: false,
      isActive: true,
      $or: [
        { email: searchRegex },
        { displayName: searchRegex },
        { phoneNumber: searchRegex },
      ],
    });

    return { users: users as unknown as Partial<IUserDocument>[], total, page, limit };
  }

  /**
   * Get user stats
   */
  async getUserStats(userId: string) {
    const user = await User.findActive(userId);
    if (!user) throw new NotFoundError('User');

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
  async getLinkedAccounts(userId: string) {
    const user = await User.findActive(userId);
    if (!user) throw new NotFoundError('User');

    const linked: Record<string, any> = {};
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
   * Register FCM token for push notifications
   */
  async registerFCMToken(userId: string, token: string): Promise<void> {
    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $addToSet: { fcmTokens: token } },
      { new: true }
    );
    if (!user) throw new NotFoundError('User');
    logger.info(`FCM token registered for user: ${userId}`);
  }

  /**
   * Upgrade user role (admin only)
   */
  async upgradeRole(userId: string, newRole: string): Promise<IUserDocument> {
    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $set: { role: newRole } },
      { new: true, runValidators: true }
    );
    if (!user) throw new NotFoundError('User');
    logger.info(`Role upgraded: ${userId} → ${newRole}`);
    return user;
  }
}

export const userService = new UserService();

import { User, IUserDocument } from '../auth/auth.model';
import { getAuth } from 'firebase-admin/auth';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import { redisClient } from '../../config/redis';
import { blacklistToken } from '../auth/auth.middleware';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../../config';
import { CONSTANTS } from '../../config/constants';

// ============================================================
// Types
// ============================================================

interface PaginatedUserSearchResult {
  users: Partial<IUserDocument>[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================
// Cache helpers
// ============================================================

const USER_CACHE_TTL = 300; // 5 minutes

const userCacheKey  = (id: string) => `user:${id}`;
const statsCacheKey = (id: string) => `user:stats:${id}`;

async function getCachedUser(userId: string): Promise<IUserDocument | null> {
  try {
    const raw = await redisClient.get(userCacheKey(userId));
    return raw ? (JSON.parse(raw) as IUserDocument) : null;
  } catch {
    return null;
  }
}

async function setCachedUser(user: IUserDocument): Promise<void> {
  try {
    await redisClient.set(
      userCacheKey(user._id.toString()),
      JSON.stringify(user),
      USER_CACHE_TTL
    );
  } catch { /* non-fatal */ }
}

async function invalidateUserCache(userId: string): Promise<void> {
  try {
    await Promise.all([
      redisClient.delete(userCacheKey(userId)),
      redisClient.delete(statsCacheKey(userId)),
    ]);
  } catch { /* non-fatal */ }
}

// ============================================================
// Escape helper — FIX: ReDoS prevention
// ============================================================

/**
 * Escapes special regex characters from user-supplied strings.
 * Prevents ReDoS attacks via crafted search queries.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// UserService
// ============================================================

export class UserService {

  // ── getUserById ─────────────────────────────────────────────────────────────
  /**
   * Get user by ID. Checks Redis cache first, falls back to DB.
   */
  async getUserById(userId: string): Promise<IUserDocument> {
    const cached = await getCachedUser(userId);
    if (cached) return cached;

    const user = await User.findActive(userId);
    if (!user) throw new NotFoundError('User');

    await setCachedUser(user);
    return user;
  }

  // ── getPublicProfile ─────────────────────────────────────────────────────────
  async getPublicProfile(userId: string): Promise<Record<string, any>> {
    const user = await User.findActive(userId);
    if (!user) throw new NotFoundError('User');
    return user.toPublicProfile();
  }

  // ── updateProfile ────────────────────────────────────────────────────────────
  async updateProfile(
    userId: string,
    updateData: Record<string, any>
  ): Promise<IUserDocument> {
    if (updateData.phoneNumber) {
      const existing = await User.findOne({
        phoneNumber: updateData.phoneNumber,
        _id: { $ne: userId },
        isDeleted: false,
      }).lean();
      if (existing) throw new ConflictError('Phone number already in use');
    }

    const allowedFields = ['displayName', 'photoURL', 'bio', 'phoneNumber'];
    const sanitized: Record<string, any> = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) sanitized[key] = updateData[key];
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $set: sanitized },
      { new: true, runValidators: true }
    );
    if (!user) throw new NotFoundError('User');

    await invalidateUserCache(userId);
    logger.info(`Profile updated: ${userId}`);
    return user;
  }

  // ── updatePreferences ────────────────────────────────────────────────────────
  async updatePreferences(
    userId: string,
    preferences: Record<string, any>
  ): Promise<IUserDocument> {
    if (preferences.defaultCurrency) {
      const valid = Object.keys(CONSTANTS.CURRENCIES);
      if (!valid.includes(preferences.defaultCurrency)) {
        throw new BadRequestError(
          `Invalid currency. Must be one of: ${valid.join(', ')}`
        );
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

    await invalidateUserCache(userId);
    logger.info(`Preferences updated: ${userId}`);
    return user;
  }

  // ── updateBankingDetails ─────────────────────────────────────────────────────
  async updateBankingDetails(
    userId: string,
    bankingDetails: Record<string, any>
  ): Promise<IUserDocument> {
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
      updateData['bankingDetails.upiVerified'] = false;
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!user) throw new NotFoundError('User');

    await invalidateUserCache(userId);
    logger.info(`Banking details updated: ${userId}`);
    return user;
  }

  // ── uploadProfilePicture ─────────────────────────────────────────────────────
  /**
   * FIX: Deletes previous profile photo from disk before writing the new one
   * to prevent orphaned files accumulating in /uploads/profiles.
   */
  async uploadProfilePicture(
    userId: string,
    file: Express.Multer.File
  ): Promise<string> {
    const allowedTypes = CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE
      .allowedTypes as readonly string[];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG');
    }
    if (file.size > CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize) {
      throw new BadRequestError('File too large. Maximum 5MB');
    }

    // Fetch current photo so we can clean it up after upload
    const existingUser = await User.findById(userId).select('photoURL').lean();

    const filename  = `profile-${userId}-${Date.now()}.webp`;
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

    // FIX: Delete old local photo file (non-blocking, non-fatal)
    if (existingUser?.photoURL?.startsWith('/uploads/profiles/')) {
      const oldPath = path.join(
        config.UPLOAD_DIR,
        existingUser.photoURL.replace('/uploads/', '')
      );
      fs.unlink(oldPath).catch((err) =>
        logger.warn(`Could not delete old profile photo: ${oldPath}`, err)
      );
    }

    await invalidateUserCache(userId);
    logger.info(`Profile picture uploaded: ${userId}`);
    return photoURL;
  }

  // ── deleteAccount ────────────────────────────────────────────────────────────
  /**
   * Soft-delete user and:
   *   1. Immediately invalidate all sessions via tokenVersion increment
   *   2. Remove Firebase account
   *   3. Clear Redis user cache
   *
   * FIX: Previously deleted users could continue using existing JWTs until
   * token expiry. tokenVersion bump closes that window instantly.
   */
  async deleteAccount(userId: string, currentAccessToken?: string): Promise<void> {
    const user = await User.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          isDeleted:     true,
          isActive:      false,
          deletedAt:     new Date(),
          refreshTokens: [],
          fcmToken:      null,
        },
        $inc: { tokenVersion: 1 }, // FIX: invalidate all existing sessions
      },
      { new: false } // we need the pre-update doc for firebaseUid
    );

    if (!user) return;

    // Blacklist the current access token immediately (belt + suspenders)
    if (currentAccessToken) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.decode(currentAccessToken) as any;
        await blacklistToken(currentAccessToken, decoded?.exp);
      } catch { /* non-fatal */ }
    }

    // Remove from Firebase (non-blocking — don't fail the delete if Firebase is down)
    if (user.firebaseUid) {
      getAuth()
        .deleteUser(user.firebaseUid)
        .then(() => logger.info(`Firebase user deleted: ${user.firebaseUid}`))
        .catch((err) =>
          logger.error(`Failed to delete Firebase user: ${user.firebaseUid}`, err)
        );
    }

    await invalidateUserCache(userId);
    logger.info(`Account deleted: ${userId}`);
  }

  // ── deactivateAccount ────────────────────────────────────────────────────────
  async deactivateAccount(userId: string): Promise<IUserDocument> {
    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      {
        $set: { isActive: false },
        $inc: { tokenVersion: 1 }, // FIX: kick active sessions on deactivation
      },
      { new: true }
    );
    if (!user) throw new NotFoundError('User');

    await invalidateUserCache(userId);
    logger.info(`Account deactivated: ${userId}`);
    return user;
  }

  // ── reactivateAccount ────────────────────────────────────────────────────────
  async reactivateAccount(userId: string): Promise<IUserDocument> {
    const user = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { isActive: true, isDeleted: false, deletedAt: null } },
      { new: true }
    );
    if (!user) throw new NotFoundError('User');

    await invalidateUserCache(userId);
    logger.info(`Account reactivated: ${userId}`);
    return user;
  }

  // ── searchUsers ──────────────────────────────────────────────────────────────
  /**
   * FIX 1: Escape user input before building RegExp — prevents ReDoS attacks.
   * FIX 2: Single $facet aggregation replaces the previous find() + countDocuments()
   *        double round-trip.
   * FIX 3: Hard cap on limit (max 50) to prevent resource exhaustion.
   */
  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedUserSearchResult> {
    // Clamp to safe bounds
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const skip      = (safePage - 1) * safeLimit;

    // FIX: Escape before building regex
    const escaped     = escapeRegex(query.trim());
    const searchRegex = new RegExp(escaped, 'i');

    const matchStage = {
      isDeleted: false,
      isActive:  true,
      $or: [
        { email:       searchRegex },
        { displayName: searchRegex },
        { phoneNumber: searchRegex },
      ],
    };

    // FIX: Single round-trip using $facet
    const [result] = await User.aggregate([
      { $match: matchStage },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: safeLimit },
            { $project: { _id: 1, email: 1, displayName: 1, photoURL: 1 } },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const users = result?.data ?? [];
    const total = result?.totalCount?.[0]?.count ?? 0;

    return {
      users: users as Partial<IUserDocument>[],
      total,
      page:  safePage,
      limit: safeLimit,
    };
  }

  // ── getUserStats ─────────────────────────────────────────────────────────────
  /**
   * FIX: Cache stats separately (same TTL) to avoid re-hitting DB on every
   * dashboard load. Invalidated alongside user cache on any mutation.
   */
  async getUserStats(userId: string) {
    try {
      const cached = await redisClient.get(statsCacheKey(userId));
      if (cached) return JSON.parse(cached);
    } catch { /* non-fatal */ }

    const user = await User.findActive(userId);
    if (!user) throw new NotFoundError('User');

    const stats = {
      totalGroups:          user.stats.totalGroups,
      totalExpenses:        user.stats.totalExpenses,
      totalSettled:         user.stats.totalSettled,
      totalPending:         user.stats.totalPending,
      totalOwedAcrossTrips: user.totalOwedAcrossTrips,
      totalLentAcrossTrips: user.totalLentAcrossTrips,
      netBalance:           user.totalLentAcrossTrips - user.totalOwedAcrossTrips,
      lastActiveAt:         user.stats.lastActiveAt,
      memberSince:          user.stats.accountCreatedAt,
      role:                 user.role,
    };

    try {
      await redisClient.set(
        statsCacheKey(userId),
        JSON.stringify(stats),
        USER_CACHE_TTL
      );
    } catch { /* non-fatal */ }

    return stats;
  }

  // ── getLinkedAccounts ─────────────────────────────────────────────────────────
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
      email:    user.email,
      verified: user.authProviders?.email?.verified || false,
    };
    return linked;
  }

  // ── upgradeRole ───────────────────────────────────────────────────────────────
  async upgradeRole(userId: string, newRole: string): Promise<IUserDocument> {
    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $set: { role: newRole } },
      { new: true, runValidators: true }
    );
    if (!user) throw new NotFoundError('User');

    await invalidateUserCache(userId);
    logger.info(`Role upgraded: ${userId} → ${newRole}`);
    return user;
  }
}

export const userService = new UserService();

// import { User, IUserDocument } from '../auth/auth.model';
// import { getAuth } from 'firebase-admin/auth';
// import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/AppError';
// import { logger } from '../../config/logger';
// import sharp from 'sharp';
// import path from 'path';
// import fs from 'fs/promises';
// import { config } from '../../config';
// import { CONSTANTS } from '../../config/constants';

// interface PaginatedUserSearchResult {
//   users: Partial<IUserDocument>[];
//   total: number;
//   page: number;
//   limit: number;
// }

// export class UserService {
  
//   /**
//    * Get user by ID (with cache)
//    */
//   async getUserById(userId: string): Promise<IUserDocument> {
//     const user = await User.findActive(userId);
//     if (!user) {
//       throw new NotFoundError('User');
//     }
//     return user;
//   }

//   /**
//    * Get public profile
//    */
//   async getPublicProfile(userId: string): Promise<Record<string, any>> {
//     const user = await User.findActive(userId);
//     if (!user) {
//       throw new NotFoundError('User');
//     }
//     return user.toPublicProfile();
//   }

//   /**
//    * Update profile
//    */
//   async updateProfile(userId: string, updateData: Record<string, any>): Promise<IUserDocument> {
//     if (updateData.phoneNumber) {
//       const existing = await User.findOne({ 
//         phoneNumber: updateData.phoneNumber, 
//         _id: { $ne: userId },
//         isDeleted: false,
//       });
//       if (existing) {
//         throw new ConflictError('Phone number already in use');
//       }
//     }

//     const allowedFields = ['displayName', 'photoURL', 'bio', 'phoneNumber'];
//     const sanitized: Record<string, any> = {};
//     for (const key of allowedFields) {
//       if (updateData[key] !== undefined) {
//         sanitized[key] = updateData[key];
//       }
//     }

//     const user = await User.findOneAndUpdate(
//       { _id: userId, isDeleted: false },
//       { $set: sanitized },
//       { new: true, runValidators: true }
//     );

//     if (!user) throw new NotFoundError('User');
//     logger.info(`Profile updated: ${userId}`);
//     return user;
//   }

//   /**
//    * Update preferences
//    */
//   async updatePreferences(userId: string, preferences: Record<string, any>): Promise<IUserDocument> {
//     if (preferences.defaultCurrency) {
//       const valid = Object.keys(CONSTANTS.CURRENCIES);
//       if (!valid.includes(preferences.defaultCurrency)) {
//         throw new BadRequestError(`Invalid currency. Must be one of: ${valid.join(', ')}`);
//       }
//     }

//     const updateData: Record<string, any> = {};
//     for (const [key, value] of Object.entries(preferences)) {
//       updateData[`preferences.${key}`] = value;
//     }

//     const user = await User.findOneAndUpdate(
//       { _id: userId, isDeleted: false },
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     if (!user) throw new NotFoundError('User');
//     logger.info(`Preferences updated: ${userId}`);
//     return user;
//   }

//   /**
//    * Update banking details
//    */
//   async updateBankingDetails(userId: string, bankingDetails: Record<string, any>): Promise<IUserDocument> {
//     if (bankingDetails.upiId) {
//       const upiRegex = /^[\w.-]+@[\w]+$/;
//       if (!upiRegex.test(bankingDetails.upiId)) {
//         throw new BadRequestError('Invalid UPI ID format (e.g., name@upi)');
//       }
//     }

//     const updateData: Record<string, any> = {};
//     for (const [key, value] of Object.entries(bankingDetails)) {
//       updateData[`bankingDetails.${key}`] = value;
//     }
//     if (bankingDetails.upiId) {
//       updateData['bankingDetails.upiVerified'] = false; // Reset on change
//     }

//     const user = await User.findOneAndUpdate(
//       { _id: userId, isDeleted: false },
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     if (!user) throw new NotFoundError('User');
//     logger.info(`Banking details updated: ${userId}`);
//     return user;
//   }

//   /**
//    * Upload profile picture
//    */
//   async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string> {
//     const allowedTypes = CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes as readonly string[];
//     if (!allowedTypes.includes(file.mimetype)) {
//       throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG');
//     }

//     if (file.size > CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize) {
//       throw new BadRequestError('File too large. Maximum 5MB');
//     }

//     const filename = `profile-${userId}-${Date.now()}.webp`;
//     const uploadDir = path.join(config.UPLOAD_DIR, 'profiles');
//     await fs.mkdir(uploadDir, { recursive: true });

//     const outputPath = path.join(uploadDir, filename);
//     await sharp(file.buffer)
//       .resize(400, 400, { fit: 'cover' })
//       .webp({ quality: 80 })
//       .toFile(outputPath);

//     const photoURL = `/uploads/profiles/${filename}`;
//     await User.findOneAndUpdate(
//       { _id: userId },
//       { $set: { photoURL } }
//     );

//     logger.info(`Profile picture uploaded: ${userId}`);
//     return photoURL;
//   }

//   /**
//    * Delete account (soft delete and remove from Firebase)
//    */
//   async deleteAccount(userId: string): Promise<void> {
//     const user = await User.findOneAndUpdate(
//       { _id: userId },
//       { 
//         $set: { 
//           isDeleted: true, 
//           isActive: false, 
//           deletedAt: new Date(),
//           refreshTokens: [],
//           fcmToken: null,
//         } 
//       }
//     );

//     if (user && user.firebaseUid) {
//       try {
//         await getAuth().deleteUser(user.firebaseUid);
//         logger.info(`Firebase user deleted: ${user.firebaseUid}`);
//       } catch (error: any) {
//         logger.error(`Failed to delete Firebase user: ${user.firebaseUid}`, error);
//       }
//     }

//     logger.info(`Account deleted: ${userId}`);
//   }

//   /**
//    * Deactivate account
//    */
//   async deactivateAccount(userId: string): Promise<IUserDocument> {
//     const user = await User.findOneAndUpdate(
//       { _id: userId, isDeleted: false },
//       { $set: { isActive: false } },
//       { new: true }
//     );
//     if (!user) throw new NotFoundError('User');
//     logger.info(`Account deactivated: ${userId}`);
//     return user;
//   }

//   /**
//    * Reactivate account
//    */
//   async reactivateAccount(userId: string): Promise<IUserDocument> {
//     const user = await User.findOneAndUpdate(
//       { _id: userId },
//       { $set: { isActive: true, isDeleted: false, deletedAt: null } },
//       { new: true }
//     );
//     if (!user) throw new NotFoundError('User');
//     logger.info(`Account reactivated: ${userId}`);
//     return user;
//   }

//   /**
//    * Search users
//    */
//   async searchUsers(query: string, page: number = 1, limit: number = 10): Promise<PaginatedUserSearchResult> {
//     const searchRegex = new RegExp(query, 'i');
//     const users = await User.find({
//       isDeleted: false,
//       isActive: true,
//       $or: [
//         { email: searchRegex },
//         { displayName: searchRegex },
//         { phoneNumber: searchRegex },
//       ],
//     })
//       .select('_id email displayName photoURL')
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean();

//     const total = await User.countDocuments({
//       isDeleted: false,
//       isActive: true,
//       $or: [
//         { email: searchRegex },
//         { displayName: searchRegex },
//         { phoneNumber: searchRegex },
//       ],
//     });

//     return { users: users as unknown as Partial<IUserDocument>[], total, page, limit };
//   }

//   /**
//    * Get user stats
//    */
//   async getUserStats(userId: string) {
//     const user = await User.findActive(userId);
//     if (!user) throw new NotFoundError('User');

//     return {
//       totalGroups: user.stats.totalGroups,
//       totalExpenses: user.stats.totalExpenses,
//       totalSettled: user.stats.totalSettled,
//       totalPending: user.stats.totalPending,
//       totalOwedAcrossTrips: user.totalOwedAcrossTrips,
//       totalLentAcrossTrips: user.totalLentAcrossTrips,
//       netBalance: user.totalLentAcrossTrips - user.totalOwedAcrossTrips,
//       lastActiveAt: user.stats.lastActiveAt,
//       memberSince: user.stats.accountCreatedAt,
//       role: user.role,
//     };
//   }

//   /**
//    * Get linked accounts
//    */
//   async getLinkedAccounts(userId: string) {
//     const user = await User.findActive(userId);
//     if (!user) throw new NotFoundError('User');

//     const linked: Record<string, any> = {};
//     if (user.authProviders?.google) {
//       linked.google = { email: user.authProviders.google.email, linked: true };
//     }
//     if (user.authProviders?.apple) {
//       linked.apple = { email: user.authProviders.apple.email, linked: true };
//     }
//     linked.email = {
//       email: user.email,
//       verified: user.authProviders?.email?.verified || false,
//     };
//     return linked;
//   }

//   /**
//    * Upgrade user role (admin only)
//    */
//   async upgradeRole(userId: string, newRole: string): Promise<IUserDocument> {
//     const user = await User.findOneAndUpdate(
//       { _id: userId, isDeleted: false },
//       { $set: { role: newRole } },
//       { new: true, runValidators: true }
//     );
//     if (!user) throw new NotFoundError('User');
//     logger.info(`Role upgraded: ${userId} → ${newRole}`);
//     return user;
//   }
// }

// export const userService = new UserService();

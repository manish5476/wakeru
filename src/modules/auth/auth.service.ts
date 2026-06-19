import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { getAuth } from 'firebase-admin/auth';
import { User, IUser, IUserDocument } from './auth.model';
import { AppError, ConflictError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { config } from '../../config';
import { logger } from '../../config/logger';

// ============================================================
// Types
// ============================================================

interface TokenPayload {
  userId: string;
  role?: string;
  type: 'access' | 'refresh';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: IUser;
  tokens: TokenPair;
  isNewUser: boolean;
}

// ============================================================
// Constants
// ============================================================

const MAX_REFRESH_TOKENS_PER_USER = 5;
const ACCESS_TOKEN_EXPIRY = config.JWT_ACCESS_EXPIRATION || '15m';
const REFRESH_TOKEN_EXPIRY = config.JWT_REFRESH_EXPIRATION || '7d';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generates access + refresh token pair.
 * Atomically stores refresh token with $slice to limit array size.
 */
const generateTokens = async (user: IUser | IUserDocument): Promise<TokenPair> => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      role: user.role,
      type: 'access',
      iss: 'tripsplit',
    } as TokenPayload,
    config.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    {
      userId: user._id,
      type: 'refresh',
      iss: 'tripsplit',
    } as TokenPayload,
    config.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
  );

  // Atomically push new token, keep only last N tokens
  // Prevents unlimited token accumulation
  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        refreshTokens: {
          $each: [refreshToken],
          $slice: -MAX_REFRESH_TOKENS_PER_USER,
        },
      },
    }
  );

  return { accessToken, refreshToken };
};

/**
 * Verifies Firebase ID token and returns decoded payload.
 */
const verifyFirebaseToken = async (idToken: string) => {
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch (error: any) {
    logger.warn('Firebase token verification failed', { error: error.message });
    if (error.code === 'auth/id-token-expired') {
      throw new UnauthorizedError('Firebase token has expired. Please login again.');
    }
    throw new UnauthorizedError('Invalid or expired Firebase ID token');
  }
};

// ============================================================
// Auth Service
// ============================================================

export const AuthService = {
  /**
   * Register a new user using Firebase ID token.
   * Creates user document + returns JWT pair.
   */
  async register(idToken: string, metadata?: { displayName?: string; phoneNumber?: string; photoURL?: string }): Promise<AuthResult> {
    const decodedToken = await verifyFirebaseToken(idToken);

    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    if (!email) {
      throw new ValidationError('Firebase token does not contain an email address');
    }

    // TODO: Re-enable email verification before production release
    // if (!decodedToken.email_verified) {
    //   throw new ForbiddenError('Email must be verified before registration');
    // }

    // Check for existing user
    const existing = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { firebaseUid },
      ],
    }).lean();

    if (existing) {
      throw new ConflictError('An account with this email already exists. Please login instead.');
    }

    // Create user with Firebase profile data + provided metadata
    const user = new User({
      _id: uuidv4(),
      firebaseUid,
      email: email.toLowerCase(),
      displayName: metadata?.displayName || decodedToken.name || 'Traveler',
      photoURL: metadata?.photoURL || decodedToken.picture || '',
      phoneNumber: metadata?.phoneNumber || decodedToken.phone_number || '',
      defaultCurrency: 'INR',
      preferredLanguage: 'en',
      lastLoginAt: new Date(),
    });

    try {
      await user.save();
      logger.info('New user registered', { userId: user._id, email: user.email });
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictError('An account with this email already exists. Please login instead.');
      }
      throw error;
    }

    const tokens = await generateTokens(user);
    return { user: user.toObject() as unknown as IUser, tokens, isNewUser: true };
  },

  /**
   * Login existing user with Firebase ID token.
   * Links Firebase UID to email-based account if not already linked.
   */
  async login(idToken: string): Promise<AuthResult> {
    const decodedToken = await verifyFirebaseToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email?.toLowerCase();

    let user = await User.findOne({ firebaseUid });

    // If no user by Firebase UID, try by email (account created before Firebase linking)
    if (!user && email && decodedToken.email_verified) {
      user = await User.findOne({ email });

      if (user) {
        // Link Firebase UID to existing email account
        user.firebaseUid = firebaseUid;
        await user.save();
        logger.info('Linked Firebase UID to existing account', {
          userId: user._id,
          email: user.email
        });
      }
    }

    // Still no user found
    if (!user) {
      throw new NotFoundError('No account found. Please register first.');
    }

    // Account status checks
    if (user.isDeleted) {
      throw new ForbiddenError('This account has been deleted. Contact support for recovery.');
    }

    if (!user.isActive) {
      throw new ForbiddenError('This account has been deactivated. Contact support.');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await generateTokens(user);
    logger.info('User logged in', { userId: user._id });

    return { user: user.toObject() as unknown as IUser, tokens, isNewUser: false };
  },

  /**
   * Refresh access token using a valid refresh token.
   * Implements token rotation: old token is consumed, new pair issued.
   */
  async refreshToken(oldRefreshToken: string): Promise<TokenPair> {
    let decoded: { userId: string; type: string };

    try {
      decoded = jwt.verify(oldRefreshToken, config.JWT_REFRESH_SECRET) as { userId: string; type: string };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Refresh token has expired. Please login again.');
      }
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Validate token type
    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Invalid token type');
    }

    // Atomically remove the old token (prevents replay attacks)
    const result = await User.updateOne(
      { _id: decoded.userId, refreshTokens: oldRefreshToken },
      { $pull: { refreshTokens: oldRefreshToken } }
    );

    if (result.modifiedCount === 0) {
      // Token was already used or doesn't exist — possible replay attack
      // Revoke ALL refresh tokens for this user (force re-login)
      await User.updateOne(
        { _id: decoded.userId },
        { $set: { refreshTokens: [] } }
      );
      logger.warn('Possible refresh token replay detected', { userId: decoded.userId });
      throw new UnauthorizedError('Token has already been used. All sessions revoked for security.');
    }

    // Verify user still exists and is active
    const user = await User.findOne({
      _id: decoded.userId,
      isActive: true,
      isDeleted: false,
    });

    if (!user) {
      throw new ForbiddenError('Account is no longer active');
    }

    // Issue new token pair
    return generateTokens(user);
  },

  /**
   * Logout — remove specific refresh token.
   * Only removes that token, other devices stay logged in.
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    await User.updateOne(
      { _id: userId },
      { $pull: { refreshTokens: refreshToken } }
    );
  },

  /**
   * Logout from ALL devices — clear all refresh tokens.
   */
  async logoutAll(userId: string): Promise<void> {
    await User.updateOne(
      { _id: userId },
      { $set: { refreshTokens: [] } }
    );
    logger.info('User logged out from all devices', { userId });
  },

  /**
   * Send password reset email via Firebase.
   * Always returns success to prevent email enumeration.
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true,
        isDeleted: false,
      });

      if (user) {
        await getAuth().generatePasswordResetLink(email);
        logger.info('Password reset email sent', { email });
      } else {
        // Log but don't reveal that email doesn't exist
        logger.info('Password reset attempted for non-existent email', { email });
      }
    } catch (error) {
      // Always succeed from the client's perspective
      logger.warn('Password reset flow error', { email, error });
    }
  },

  /**
   * Update user profile fields.
   */
  async updateProfile(userId: string, updates: Record<string, any>): Promise<IUser> {
    // Whitelist allowed fields for security
    const allowedFields = [
      'displayName',
      'photoURL',
      'bio',
      'phoneNumber',
      'preferredLanguage',
      'defaultCurrency',
      'preferences',
    ];

    const sanitizedUpdates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: sanitizedUpdates },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info('User profile updated', { userId });
    return user.toObject() as unknown as IUser;
  },

  /**
   * Set user's UPI ID.
   */
  /**
  * Set user's UPI ID.
  */
  async setUpiId(userId: string, upiId: string): Promise<IUser> {
    // Check if UPI ID is already taken by another user
    const existing = await User.findOne({
      'bankingDetails.upiId': upiId,        // ✅ FIXED
      _id: { $ne: userId },
      isActive: true,
      isDeleted: false,
    });

    if (existing) {
      throw new ConflictError('This UPI ID is already associated with another account');
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, isActive: true, isDeleted: false },
      {
        $set: {
          'bankingDetails.upiId': upiId,        // ✅ FIXED
          'bankingDetails.upiVerified': false,  // Reset verification when UPI changes
        }
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user.toObject() as unknown as IUser;
  },

  /**
   * Verify UPI ID (penny drop simulation).
   */
  /**
  * Verify UPI ID (penny drop simulation).
  */
  async verifyUpi(userId: string): Promise<boolean> {
    const user = await User.findOne({
      _id: userId,
      isActive: true,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // ✅ FIXED: upiId is inside bankingDetails
    if (!user.bankingDetails?.upiId) {
      throw new ValidationError('No UPI ID set. Please set your UPI ID first.');
    }

    // In production: trigger actual penny drop via UPI gateway
    // For now: simulate verification
    const verified = true; // Replace with actual verification logic

    if (verified) {
      await User.updateOne(
        { _id: userId },
        { $set: { 'bankingDetails.upiVerified': true } }
      );
      logger.info('UPI verified', { userId, upiId: user.bankingDetails.upiId });
    }

    return verified;
  },

  /**
   * Update FCM token for push notifications.
   */
  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await User.updateOne(
      { _id: userId },
      { $set: { fcmToken } }
    );
  },

  /**
   * Deactivate account (soft delete).
   */
  async deactivateAccount(userId: string): Promise<void> {
    const user = await User.findOneAndUpdate(
      { _id: userId, isActive: true, isDeleted: false },
      {
        $set: {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
          refreshTokens: [], // Revoke all sessions
          fcmToken: null,    // Stop push notifications
        }
      },
      { new: true }
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info('Account deactivated', { userId });
  },

  /**
   * Reactivate account.
   */
  async reactivateAccount(userId: string): Promise<IUser> {
    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: true },
      {
        $set: {
          isActive: true,
          isDeleted: false,
          deletedAt: null,
        }
      },
      { new: true }
    );

    if (!user) {
      throw new NotFoundError('Deleted account not found');
    }

    logger.info('Account reactivated', { userId });
    return user.toObject() as unknown as IUser;
  },
};
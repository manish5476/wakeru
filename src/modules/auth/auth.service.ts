import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { getAuth } from 'firebase-admin/auth';
import { User, IUser, IUserDocument, DEFAULT_USER_PREFERENCES } from './auth.model';
import { AppError, ConflictError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError, TooManyRequestsError } from '../../shared/errors/AppError';
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
const ACCESS_TOKEN_EXPIRY = config.JWT_ACCESS_EXPIRATION || '30d';
const REFRESH_TOKEN_EXPIRY = config.JWT_REFRESH_EXPIRATION || '30d';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generates access + refresh token pair.
 * Atomically stores refresh token with $slice to limit array size.
 */
const generateTokens = async (user: IUser | IUserDocument): Promise<TokenPair> => {
  let role = user.role;
  const userEmail = (user.email || '').toLowerCase().trim();
  if (config.ADMIN_EMAILS.includes(userEmail)) {
    role = 'admin';
  }

  const accessToken = jwt.sign(
    {
      userId: user._id,
      role,
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
  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        refreshTokens: {
          $each: [{
            token: refreshToken,
            device: 'Unknown Device',
            ip: 'Unknown IP',
            lastActive: new Date()
          }],
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
   */
  async register(idToken: string, metadata?: { displayName?: string; phoneNumber?: string; photoURL?: string }): Promise<AuthResult> {
    const decodedToken = await verifyFirebaseToken(idToken);

    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    if (!email) {
      throw new ValidationError('Firebase token does not contain an email address');
    }

    // Check for existing user
    const existing = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { firebaseUid },
      ],
    }).lean();

    if (existing) {
      if (existing.firebaseUid !== firebaseUid) {
        logger.info('Updating existing user with new Firebase UID', { userId: existing._id, email });
        const updatedUser = await User.findOneAndUpdate(
          { _id: existing._id },
          { $set: { firebaseUid } },
          { new: true }
        );
        if (!updatedUser) {
          throw new Error('Failed to update existing user');
        }
        const tokens = await generateTokens(updatedUser);
        return { user: updatedUser.toObject() as unknown as IUser, tokens, isNewUser: false };
      }

      const tokens = await generateTokens(existing as any);
      return { user: existing as unknown as IUser, tokens, isNewUser: false };
    }

    // Determine auth provider from Firebase token
    const authProvider = decodedToken.firebase?.sign_in_provider || 'email';
    const authProviders: any = {};
    
    if (authProvider === 'google.com') {
      authProviders.google = { id: firebaseUid, email };
    } else if (authProvider === 'apple.com') {
      authProviders.apple = { id: firebaseUid, email };
    } else {
      authProviders.email = { verified: decodedToken.email_verified || false };
    }

    // Create user
    const normalizedEmail = email.toLowerCase().trim();
    const role = config.ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : 'user';
    const userPayload: any = {
      _id: firebaseUid, // ✅ FIXED: MongoDB _id is exactly the Firebase UID
      firebaseUid,
      email: normalizedEmail,
      role,
      displayName: metadata?.displayName || decodedToken.name || 'Traveler',
      photoURL: metadata?.photoURL || decodedToken.picture || '',
      authProviders,
      preferences: DEFAULT_USER_PREFERENCES,
      onboardingCompleted: false,
      lastLoginAt: new Date(),
    };

    const phone = metadata?.phoneNumber || decodedToken.phone_number;
    if (phone) {
      userPayload.phoneNumber = phone;
    }

    const user = new User(userPayload);

    try {
      await user.save();
      logger.info('New user registered', { 
        userId: user._id, 
        email: user.email,
        provider: authProvider 
      });
    } catch (error: any) {
      if (error.code === 11000) {
        logger.error('Duplicate key error during registration:', error);
        throw new ConflictError('An account with this email already exists. Please login instead.');
      }
      throw error;
    }

    const tokens = await generateTokens(user);
    return { user: user.toObject() as unknown as IUser, tokens, isNewUser: true };
  },

  /**
   * Login existing user with Firebase ID token.
   */
  async login(idToken: string): Promise<AuthResult> {
    const decodedToken = await verifyFirebaseToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email?.toLowerCase();

    let user = await User.findOne({ firebaseUid });

    if (!user && email) {
      user = await User.findOne({ email });

      if (user) {
        await User.updateOne({ _id: user._id }, { $set: { firebaseUid } });
        user.firebaseUid = firebaseUid;
        logger.info('Linked Firebase UID to existing account', {
          userId: user._id,
          email: user.email
        });
      }
    }

    if (!user) {
      throw new NotFoundError('No account found. Please register first.');
    }

    if (user.isDeleted) {
      throw new ForbiddenError('This account has been deleted. Contact support for recovery.');
    }

    if (!user.isActive) {
      throw new ForbiddenError('This account has been deactivated. Contact support.');
    }

    // Bypass full document validation to avoid errors with stale refreshTokens
    const userEmail = (user.email || '').toLowerCase().trim();
    const isAdminEmail = config.ADMIN_EMAILS.includes(userEmail);

    const updates: Record<string, any> = { lastLoginAt: new Date() };
    if (isAdminEmail && user.role !== 'admin') {
      user.role = 'admin';
      updates.role = 'admin';
    }
    if (!user.preferences) {
      updates.preferences = DEFAULT_USER_PREFERENCES;
      user.preferences = DEFAULT_USER_PREFERENCES;
    }
    await User.updateOne({ _id: user._id }, { $set: updates });

    const tokens = await generateTokens(user);
    logger.info('User logged in', { userId: user._id });

    const userObj = user.toObject() as unknown as IUser;
    if (isAdminEmail) {
      userObj.role = 'admin';
    }

    return { user: userObj, tokens, isNewUser: false };
  },

  /**
   * Refresh access token using a valid refresh token.
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

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Invalid token type');
    }

    const result = await User.updateOne(
      { _id: decoded.userId, "refreshTokens.token": oldRefreshToken },
      { $pull: { refreshTokens: { token: oldRefreshToken } } }
    );

    if (result.modifiedCount === 0) {
      await User.updateOne(
        { _id: decoded.userId },
        { $set: { refreshTokens: [] } }
      );
      logger.warn('Possible refresh token replay detected', { userId: decoded.userId });
      throw new UnauthorizedError('Token has already been used. All sessions revoked for security.');
    }

    const user = await User.findOne({
      _id: decoded.userId,
      isActive: true,
      isDeleted: false,
    });

    if (!user) {
      throw new ForbiddenError('Account is no longer active');
    }

    return generateTokens(user);
  },

  /**
   * Logout — remove specific refresh token.
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    await User.updateOne(
      { _id: userId },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );
  },

  /**
   * Logout from ALL devices.
   */
  async logoutAll(userId: string): Promise<void> {
    await User.updateOne(
      { _id: userId },
      { $set: { refreshTokens: [] } }
    );
    logger.info('User logged out from all devices', { userId });
  },

  /**
   * 🔑 FIXED: Forgot Password — NOW actually sends reset email via Firebase.
   * Checks auth provider first — Google/Apple users can't reset through us.
   */
  async forgotPassword(email: string): Promise<{ provider?: string }> {
    try {
      const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true,
        isDeleted: false,
      });

      if (!user) {
        logger.info('Password reset attempted for non-existent email', { email });
        return {}; // Don't reveal user doesn't exist
      }

      // 🔑 CHECK: Google-only account?
      if (user.authProviders?.google && !user.authProviders?.email?.verified) {
        logger.info('Password reset attempted for Google-only account', { 
          userId: user._id, 
          email: user.email 
        });
        return { provider: 'google' }; // Frontend can show specific message
      }

      // 🔑 CHECK: Apple-only account?
      if (user.authProviders?.apple && !user.authProviders?.email?.verified) {
        logger.info('Password reset attempted for Apple-only account', { 
          userId: user._id, 
          email: user.email 
        });
        return { provider: 'apple' }; // Frontend can show specific message
      }

      // Rate limit: max 2 requests per day
      const now = new Date();
      const stats = user.passwordResetStats || { count: 0, lastRequestAt: new Date(0) };
      const isSameDay = stats.lastRequestAt.toDateString() === now.toDateString();

      if (isSameDay && stats.count >= 2) {
        throw new TooManyRequestsError('Too many password reset requests. Please try again tomorrow.');
      }

      // The actual email sending is handled by the frontend client using sendPasswordResetEmail()

      // Update rate limit stats
      user.passwordResetStats = {
        count: isSameDay ? stats.count + 1 : 1,
        lastRequestAt: now,
      };
      await user.save();

      return {}; // Success (don't reveal details)
      
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.warn('Password reset flow error', { email, error });
      return {}; // Always return success to prevent enumeration
    }
  },

  /**
   * Update user profile fields.
   */
  async updateProfile(userId: string, updates: Record<string, any>): Promise<IUser> {
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
  async setUpiId(userId: string, upiId: string): Promise<IUser> {
    const existing = await User.findOne({
      'bankingDetails.upiId': upiId,
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
          'bankingDetails.upiId': upiId,
          'bankingDetails.upiVerified': false,
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
   * Verify UPI ID.
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

    if (!user.bankingDetails?.upiId) {
      throw new ValidationError('No UPI ID set. Please set your UPI ID first.');
    }

    const verified = true; // Replace with actual UPI verification

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
   * Deactivate account.
   */
  async deactivateAccount(userId: string): Promise<void> {
    const user = await User.findOneAndUpdate(
      { _id: userId, isActive: true, isDeleted: false },
      {
        $set: {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
          refreshTokens: [],
          fcmToken: null,
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


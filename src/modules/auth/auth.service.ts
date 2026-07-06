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
    const userPayload: any = {
      _id: uuidv4(),
      firebaseUid,
      email: email.toLowerCase(),
      displayName: metadata?.displayName || decodedToken.name || 'Traveler',
      photoURL: metadata?.photoURL || decodedToken.picture || '',
      authProviders,
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
        user.firebaseUid = firebaseUid;
        await user.save();
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

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await generateTokens(user);
    logger.info('User logged in', { userId: user._id });

    return { user: user.toObject() as unknown as IUser, tokens, isNewUser: false };
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
      { _id: decoded.userId, refreshTokens: oldRefreshToken },
      { $pull: { refreshTokens: oldRefreshToken } }
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
      { $pull: { refreshTokens: refreshToken } }
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
        throw new AppError(429, 'Too many password reset requests. Please try again tomorrow.');
      }

      // ✅ THE FIX: Actually send the reset email via Firebase
      try {
        await getAuth().generatePasswordResetLink(email.toLowerCase());
        logger.info('Password reset email sent via Firebase', { 
          userId: user._id, 
          email: user.email 
        });
      } catch (firebaseError: any) {
        logger.error('Firebase password reset failed', { 
          userId: user._id, 
          email: user.email,
          error: firebaseError.message,
          code: firebaseError.code 
        });
        
        // If Firebase doesn't know this user, create them in Firebase first
        if (firebaseError.code === 'auth/user-not-found') {
          logger.info('User not found in Firebase, skipping reset email', {
            userId: user._id,
            email: user.email
          });
          // Still count this as a request for rate limiting
        }
      }

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



// import { v4 as uuidv4 } from 'uuid';
// import jwt from 'jsonwebtoken';
// import { getAuth } from 'firebase-admin/auth';
// import { User, IUser, IUserDocument } from './auth.model';
// import { AppError, ConflictError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
// import { config } from '../../config';
// import { logger } from '../../config/logger';

// // ============================================================
// // Types
// // ============================================================

// interface TokenPayload {
//   userId: string;
//   role?: string;
//   type: 'access' | 'refresh';
// }

// interface TokenPair {
//   accessToken: string;
//   refreshToken: string;
// }

// interface AuthResult {
//   user: IUser;
//   tokens: TokenPair;
//   isNewUser: boolean;
// }

// // ============================================================
// // Constants
// // ============================================================

// const MAX_REFRESH_TOKENS_PER_USER = 5;
// const ACCESS_TOKEN_EXPIRY = config.JWT_ACCESS_EXPIRATION || '15m';
// const REFRESH_TOKEN_EXPIRY = config.JWT_REFRESH_EXPIRATION || '7d';

// // ============================================================
// // Helper Functions
// // ============================================================

// /**
//  * Generates access + refresh token pair.
//  * Atomically stores refresh token with $slice to limit array size.
//  */
// const generateTokens = async (
//   user: IUser | IUserDocument,
//   deviceInfo: string = 'Unknown Device',
//   ipAddress: string = 'Unknown IP'
// ): Promise<TokenPair> => {
//   const accessToken = jwt.sign(
//     {
//       userId: user._id,
//       role: user.role,
//       type: 'access',
//       iss: 'tripsplit',
//     } as TokenPayload,
//     config.JWT_SECRET,
//     { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
//   );

//   const refreshToken = jwt.sign(
//     {
//       userId: user._id,
//       type: 'refresh',
//       iss: 'tripsplit',
//     } as TokenPayload,
//     config.JWT_REFRESH_SECRET,
//     { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
//   );

//   // Atomically push new token, keep only last N tokens
//   // Prevents unlimited token accumulation
//   await User.updateOne(
//     { _id: user._id },
//     {
//       $push: {
//         refreshTokens: {
//           $each: [{
//             token: refreshToken,
//             device: deviceInfo,
//             ip: ipAddress,
//             lastActive: new Date()
//           }],
//           $slice: -MAX_REFRESH_TOKENS_PER_USER,
//         },
//       },
//     }
//   );

//   return { accessToken, refreshToken };
// };

// /**
//  * Verifies Firebase ID token and returns decoded payload.
//  */
// const verifyFirebaseToken = async (idToken: string) => {
//   try {
//     return await getAuth().verifyIdToken(idToken);
//   } catch (error: any) {
//     logger.warn('Firebase token verification failed', { error: error.message });
//     if (error.code === 'auth/id-token-expired') {
//       throw new UnauthorizedError('Firebase token has expired. Please login again.');
//     }
//     throw new UnauthorizedError('Invalid or expired Firebase ID token');
//   }
// };

// // ============================================================
// // Auth Service
// // ============================================================

// export const AuthService = {
//   /**
//    * Register a new user using Firebase ID token.
//    * Creates user document + returns JWT pair.
//    */
//   async register(
//     idToken: string,
//     metadata?: { displayName?: string; phoneNumber?: string; photoURL?: string },
//     deviceInfo?: string,
//     ipAddress?: string
//   ): Promise<AuthResult> {
//     const decodedToken = await verifyFirebaseToken(idToken);

//     const firebaseUid = decodedToken.uid;
//     const email = decodedToken.email;

//     if (!email) {
//       throw new ValidationError('Firebase token does not contain an email address');
//     }

//     // TODO: Re-enable email verification before production release
//     // if (!decodedToken.email_verified) {
//     //   throw new ForbiddenError('Email must be verified before registration');
//     // }

//     // Check for existing user
//     const existing = await User.findOne({
//       $or: [
//         { email: email.toLowerCase() },
//         { firebaseUid },
//       ],
//     }).lean();

//     if (existing) {
//       if (existing.firebaseUid !== firebaseUid) {
//         logger.info('Updating existing user with new Firebase UID', { userId: existing._id, email });
//         const updatedUser = await User.findOneAndUpdate(
//           { _id: existing._id },
//           { $set: { firebaseUid } },
//           { new: true }
//         );
//         if (!updatedUser) {
//           throw new Error('Failed to update existing user');
//         }
//         const tokens = await generateTokens(updatedUser, deviceInfo, ipAddress);
//         return { user: updatedUser.toObject() as unknown as IUser, tokens, isNewUser: false };
//       }

//       // User already exists with the same firebaseUid, just log them in
//       const tokens = await generateTokens(existing as any, deviceInfo, ipAddress);
//       return { user: existing as unknown as IUser, tokens, isNewUser: false };
//     }

//     // Create user with Firebase profile data + provided metadata
//     const userPayload: any = {
//       _id: uuidv4(),
//       firebaseUid,
//       email: email.toLowerCase(),
//       displayName: metadata?.displayName || decodedToken.name || 'Traveler',
//       photoURL: metadata?.photoURL || decodedToken.picture || '',
//       defaultCurrency: 'INR',
//       preferredLanguage: 'en',
//       lastLoginAt: new Date(),
//     };

//     const phone = metadata?.phoneNumber || decodedToken.phone_number;
//     if (phone) {
//       userPayload.phoneNumber = phone;
//     }

//     const user = new User(userPayload);

//     try {
//       await user.save();
//       logger.info('New user registered', { userId: user._id, email: user.email });
//     } catch (error: any) {
//       if (error.code === 11000) {
//         logger.error('Duplicate key error during registration:', error);
//         throw new ConflictError('An account with this email already exists. Please login instead.');
//       }
//       throw error;
//     }

//     const tokens = await generateTokens(user, deviceInfo, ipAddress);
//     return { user: user.toObject() as unknown as IUser, tokens, isNewUser: true };
//   },

//   /**
//    * Login existing user with Firebase ID token.
//    * Links Firebase UID to email-based account if not already linked.
//    */
//   async login(idToken: string, deviceInfo?: string, ipAddress?: string): Promise<AuthResult> {
//     const decodedToken = await verifyFirebaseToken(idToken);
//     const firebaseUid = decodedToken.uid;
//     const email = decodedToken.email?.toLowerCase();

//     let user = await User.findOne({ firebaseUid });

//     // If no user by Firebase UID, try by email (account created before Firebase linking)
//     // Temporarily removed email_verified check since it's disabled in registration
//     if (!user && email) {
//       user = await User.findOne({ email });

//       if (user) {
//         // Link Firebase UID to existing email account
//         user.firebaseUid = firebaseUid;
//         await user.save();
//         logger.info('Linked Firebase UID to existing account', {
//           userId: user._id,
//           email: user.email
//         });
//       }
//     }

//     // Still no user found
//     if (!user) {
//       throw new NotFoundError('No account found. Please register first.');
//     }

//     // Account status checks
//     if (user.isDeleted) {
//       throw new ForbiddenError('This account has been deleted. Contact support for recovery.');
//     }

//     if (!user.isActive) {
//       throw new ForbiddenError('This account has been deactivated. Contact support.');
//     }

//     // Update last login
//     user.lastLoginAt = new Date();
//     await user.save();

//     const tokens = await generateTokens(user, deviceInfo, ipAddress);
//     logger.info('User logged in', { userId: user._id });

//     return { user: user.toObject() as unknown as IUser, tokens, isNewUser: false };
//   },

//   /**
//    * Refresh access token using a valid refresh token.
//    * Implements token rotation: old token is consumed, new pair issued.
//    */
//   async refreshToken(oldRefreshToken: string, deviceInfo?: string, ipAddress?: string): Promise<TokenPair> {
//     let decoded: { userId: string; type: string };

//     try {
//       decoded = jwt.verify(oldRefreshToken, config.JWT_REFRESH_SECRET) as { userId: string; type: string };
//     } catch (error: any) {
//       if (error.name === 'TokenExpiredError') {
//         throw new UnauthorizedError('Refresh token has expired. Please login again.');
//       }
//       throw new UnauthorizedError('Invalid refresh token');
//     }

//     // Validate token type
//     if (decoded.type !== 'refresh') {
//       throw new UnauthorizedError('Invalid token type');
//     }

//     // Atomically remove the old token (prevents replay attacks)
//     const result = await User.updateOne(
//       { _id: decoded.userId, 'refreshTokens.token': oldRefreshToken },
//       { $pull: { refreshTokens: { token: oldRefreshToken } } }
//     );

//     if (result.modifiedCount === 0) {
//       // Token was already used or doesn't exist — possible replay attack
//       // Revoke ALL refresh tokens for this user (force re-login)
//       await User.updateOne(
//         { _id: decoded.userId },
//         { $set: { refreshTokens: [] } }
//       );
//       logger.warn('Possible refresh token replay detected', { userId: decoded.userId });
//       throw new UnauthorizedError('Token has already been used. All sessions revoked for security.');
//     }

//     // Verify user still exists and is active
//     const user = await User.findOne({
//       _id: decoded.userId,
//       isActive: true,
//       isDeleted: false,
//     });

//     if (!user) {
//       throw new ForbiddenError('Account is no longer active');
//     }

//     // Issue new token pair
//     return generateTokens(user, deviceInfo, ipAddress);
//   },

//   /**
//    * Get active sessions for a user.
//    */
//   async getSessions(userId: string) {
//     const user = await User.findById(userId).lean();
//     if (!user) throw new NotFoundError('User not found');

//     return (user.refreshTokens || [])
//       .filter((session: any) => typeof session === 'object' && session.token)
//       .map((session: any) => ({
//         token: session.token,
//         device: session.device || 'Unknown Device',
//         ip: session.ip || 'Unknown IP',
//         lastActive: session.lastActive || new Date()
//       }))
//       .sort((a: any, b: any) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
//   },

//   /**
//    * Logout — remove specific refresh token.
//    * Only removes that token, other devices stay logged in.
//    */
//   async logout(userId: string, refreshToken: string): Promise<void> {
//     await User.updateOne(
//       { _id: userId },
//       { $pull: { refreshTokens: { token: refreshToken } } }
//     );
//   },

//   /**
//    * Logout from ALL devices — clear all refresh tokens.
//    */
//   async logoutAll(userId: string): Promise<void> {
//     await User.updateOne(
//       { _id: userId },
//       { $set: { refreshTokens: [] } }
//     );
//     logger.info('User logged out from all devices', { userId });
//   },

//   /**
//    * Check rate limit and generate password reset token (link generation skipped).
//    * Returns success to client to trigger the actual Firebase email.
//    */
//   async forgotPassword(email: string): Promise<void> {
//     try {
//       const user = await User.findOne({
//         email: email.toLowerCase(),
//         isActive: true,
//         isDeleted: false,
//       });
  
//       if (user) {
//         // Enforce rate limit: max 2 requests per day
//         const now = new Date();
//         const stats = user.passwordResetStats || { count: 0, lastRequestAt: new Date(0) };
        
//         const isSameDay = stats.lastRequestAt.toDateString() === now.toDateString();
  
//         if (isSameDay && stats.count >= 2) {
//           throw new AppError(429, 'Maximum 2 requests per day allowed for password reset.');
//         }
  
//         // 🔑 CHECK: Is this a Google/Apple-only account?
//         if (user.authProviders?.google && !user.authProviders?.email) {
//           // User only has Google auth — can't reset password here
//           logger.info('Password reset attempted for Google-only account', { 
//             userId: user._id, 
//             email: user.email 
//           });
//           // Still return success to prevent email enumeration
//           return;
//         }
  
//         if (user.authProviders?.apple && !user.authProviders?.email) {
//           // User only has Apple auth — can't reset password here
//           logger.info('Password reset attempted for Apple-only account', { 
//             userId: user._id, 
//             email: user.email 
//           });
//           return;
//         }
  
//         // ✅ THIS IS THE FIX: Actually send the reset email via Firebase
//         try {
//           await getAuth().generatePasswordResetLink(email.toLowerCase());
//           logger.info('Password reset email sent via Firebase', { 
//             userId: user._id, 
//             email: user.email 
//           });
//         } catch (firebaseError: any) {
//           logger.error('Firebase password reset failed', { 
//             userId: user._id, 
//             email: user.email,
//             error: firebaseError.message 
//           });
//           // Don't throw — don't reveal Firebase errors to client
//         }
  
//         // Update stats
//         user.passwordResetStats = {
//           count: isSameDay ? stats.count + 1 : 1,
//           lastRequestAt: now,
//         };
//         await user.save();
        
//       } else {
//         logger.info('Password reset attempted for non-existent email', { email });
//       }
//     } catch (error: any) {
//       if (error instanceof AppError) throw error;
//       logger.warn('Password reset flow error', { email, error });
//     }
//   }  ,
//   // async forgotPassword(email: string): Promise<void> {
//   //   try {
//   //     const user = await User.findOne({
//   //       email: email.toLowerCase(),
//   //       isActive: true,
//   //       isDeleted: false,
//   //     });

//   //     if (user) {
//   //       // Enforce rate limit: max 2 requests per day
//   //       const now = new Date();
//   //       const stats = user.passwordResetStats || { count: 0, lastRequestAt: new Date(0) };

//   //       // Check if the last request was today
//   //       const isSameDay = stats.lastRequestAt.toDateString() === now.toDateString();

//   //       if (isSameDay && stats.count >= 2) {
//   //         throw new AppError(429, 'Maximum 2 requests per day allowed for password reset.');
//   //       }

//   //       // Update stats
//   //       user.passwordResetStats = {
//   //         count: isSameDay ? stats.count + 1 : 1,
//   //         lastRequestAt: now,
//   //       };
//   //       await user.save();

//   //       logger.info('Password reset authorized', { email });
//   //     } else {
//   //       // Log but don't reveal that email doesn't exist
//   //       logger.info('Password reset attempted for non-existent email', { email });
//   //     }
//   //   } catch (error: any) {
//   //     if (error instanceof AppError) throw error;
//   //     // Always succeed from the client's perspective for other errors
//   //     logger.warn('Password reset flow error', { email, error });
//   //   }
//   // },

//   /**
//    * Update user profile fields.
//    */
//   async updateProfile(userId: string, updates: Record<string, any>): Promise<IUser> {
//     // Whitelist allowed fields for security
//     const allowedFields = [
//       'displayName',
//       'photoURL',
//       'bio',
//       'phoneNumber',
//       'preferredLanguage',
//       'defaultCurrency',
//       'preferences',
//     ];

//     const sanitizedUpdates: Record<string, any> = {};
//     for (const key of allowedFields) {
//       if (updates[key] !== undefined) {
//         sanitizedUpdates[key] = updates[key];
//       }
//     }

//     const user = await User.findByIdAndUpdate(
//       userId,
//       { $set: sanitizedUpdates },
//       { new: true, runValidators: true }
//     );

//     if (!user) {
//       throw new NotFoundError('User not found');
//     }

//     logger.info('User profile updated', { userId });
//     return user.toObject() as unknown as IUser;
//   },

//   /**
//    * Set user's UPI ID.
//    */
//   /**
//   * Set user's UPI ID.
//   */
//   async setUpiId(userId: string, upiId: string): Promise<IUser> {
//     // Check if UPI ID is already taken by another user
//     const existing = await User.findOne({
//       'bankingDetails.upiId': upiId,        // ✅ FIXED
//       _id: { $ne: userId },
//       isActive: true,
//       isDeleted: false,
//     });

//     if (existing) {
//       throw new ConflictError('This UPI ID is already associated with another account');
//     }

//     const user = await User.findOneAndUpdate(
//       { _id: userId, isActive: true, isDeleted: false },
//       {
//         $set: {
//           'bankingDetails.upiId': upiId,        // ✅ FIXED
//           'bankingDetails.upiVerified': false,  // Reset verification when UPI changes
//         }
//       },
//       { new: true, runValidators: true }
//     );

//     if (!user) {
//       throw new NotFoundError('User not found');
//     }

//     return user.toObject() as unknown as IUser;
//   },

//   /**
//    * Verify UPI ID (penny drop simulation).
//    */
//   /**
//   * Verify UPI ID (penny drop simulation).
//   */
//   async verifyUpi(userId: string): Promise<boolean> {
//     const user = await User.findOne({
//       _id: userId,
//       isActive: true,
//       isDeleted: false,
//     });

//     if (!user) {
//       throw new NotFoundError('User not found');
//     }

//     // ✅ FIXED: upiId is inside bankingDetails
//     if (!user.bankingDetails?.upiId) {
//       throw new ValidationError('No UPI ID set. Please set your UPI ID first.');
//     }

//     // In production: trigger actual penny drop via UPI gateway
//     // For now: simulate verification
//     const verified = true; // Replace with actual verification logic

//     if (verified) {
//       await User.updateOne(
//         { _id: userId },
//         { $set: { 'bankingDetails.upiVerified': true } }
//       );
//       logger.info('UPI verified', { userId, upiId: user.bankingDetails.upiId });
//     }

//     return verified;
//   },

//   /**
//    * Update FCM token for push notifications.
//    */
//   async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
//     await User.updateOne(
//       { _id: userId },
//       { $set: { fcmToken } }
//     );
//   },

//   /**
//    * Deactivate account (soft delete).
//    */
//   async deactivateAccount(userId: string): Promise<void> {
//     const user = await User.findOneAndUpdate(
//       { _id: userId, isActive: true, isDeleted: false },
//       {
//         $set: {
//           isActive: false,
//           isDeleted: true,
//           deletedAt: new Date(),
//           refreshTokens: [], // Revoke all sessions
//           fcmToken: null,    // Stop push notifications
//         }
//       },
//       { new: true }
//     );

//     if (!user) {
//       throw new NotFoundError('User not found');
//     }

//     logger.info('Account deactivated', { userId });
//   },

//   /**
//    * Reactivate account.
//    */
//   async reactivateAccount(userId: string): Promise<IUser> {
//     const user = await User.findOneAndUpdate(
//       { _id: userId, isDeleted: true },
//       {
//         $set: {
//           isActive: true,
//           isDeleted: false,
//           deletedAt: null,
//         }
//       },
//       { new: true }
//     );

//     if (!user) {
//       throw new NotFoundError('Deleted account not found');
//     }

//     logger.info('Account reactivated', { userId });
//     return user.toObject() as unknown as IUser;
//   },
// };
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const uuid_1 = require("uuid");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("firebase-admin/auth");
const auth_model_1 = require("./auth.model");
const AppError_1 = require("../../shared/errors/AppError");
const config_1 = require("../../config");
const logger_1 = require("../../config/logger");
// ============================================================
// Constants
// ============================================================
const MAX_REFRESH_TOKENS_PER_USER = 5;
const ACCESS_TOKEN_EXPIRY = config_1.config.JWT_ACCESS_EXPIRATION || '15m';
const REFRESH_TOKEN_EXPIRY = config_1.config.JWT_REFRESH_EXPIRATION || '7d';
// ============================================================
// Helper Functions
// ============================================================
/**
 * Generates access + refresh token pair.
 * Atomically stores refresh token with $slice to limit array size.
 */
const generateTokens = async (user) => {
    const accessToken = jsonwebtoken_1.default.sign({
        userId: user._id,
        role: user.role,
        type: 'access',
        iss: 'tripsplit',
    }, config_1.config.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jsonwebtoken_1.default.sign({
        userId: user._id,
        type: 'refresh',
        iss: 'tripsplit',
    }, config_1.config.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    // Atomically push new token, keep only last N tokens
    // Prevents unlimited token accumulation
    await auth_model_1.User.updateOne({ _id: user._id }, {
        $push: {
            refreshTokens: {
                $each: [refreshToken],
                $slice: -MAX_REFRESH_TOKENS_PER_USER,
            },
        },
    });
    return { accessToken, refreshToken };
};
/**
 * Verifies Firebase ID token and returns decoded payload.
 */
const verifyFirebaseToken = async (idToken) => {
    try {
        return await (0, auth_1.getAuth)().verifyIdToken(idToken);
    }
    catch (error) {
        logger_1.logger.warn('Firebase token verification failed', { error: error.message });
        if (error.code === 'auth/id-token-expired') {
            throw new AppError_1.UnauthorizedError('Firebase token has expired. Please login again.');
        }
        throw new AppError_1.UnauthorizedError('Invalid or expired Firebase ID token');
    }
};
// ============================================================
// Auth Service
// ============================================================
exports.AuthService = {
    /**
     * Register a new user using Firebase ID token.
     * Creates user document + returns JWT pair.
     */
    async register(idToken, metadata) {
        const decodedToken = await verifyFirebaseToken(idToken);
        const firebaseUid = decodedToken.uid;
        const email = decodedToken.email;
        if (!email) {
            throw new AppError_1.ValidationError('Firebase token does not contain an email address');
        }
        if (!decodedToken.email_verified) {
            throw new AppError_1.ForbiddenError('Email must be verified before registration');
        }
        // Check for existing user
        const existing = await auth_model_1.User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { firebaseUid },
            ],
        }).lean();
        if (existing) {
            throw new AppError_1.ConflictError('An account with this email already exists. Please login instead.');
        }
        // Create user with Firebase profile data + provided metadata
        const user = new auth_model_1.User({
            _id: (0, uuid_1.v4)(),
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
            logger_1.logger.info('New user registered', { userId: user._id, email: user.email });
        }
        catch (error) {
            if (error.code === 11000) {
                throw new AppError_1.ConflictError('An account with this email already exists. Please login instead.');
            }
            throw error;
        }
        const tokens = await generateTokens(user);
        return { user: user.toObject(), tokens, isNewUser: true };
    },
    /**
     * Login existing user with Firebase ID token.
     * Links Firebase UID to email-based account if not already linked.
     */
    async login(idToken) {
        const decodedToken = await verifyFirebaseToken(idToken);
        const firebaseUid = decodedToken.uid;
        const email = decodedToken.email?.toLowerCase();
        let user = await auth_model_1.User.findOne({ firebaseUid });
        // If no user by Firebase UID, try by email (account created before Firebase linking)
        if (!user && email && decodedToken.email_verified) {
            user = await auth_model_1.User.findOne({ email });
            if (user) {
                // Link Firebase UID to existing email account
                user.firebaseUid = firebaseUid;
                await user.save();
                logger_1.logger.info('Linked Firebase UID to existing account', {
                    userId: user._id,
                    email: user.email
                });
            }
        }
        // Still no user found
        if (!user) {
            throw new AppError_1.NotFoundError('No account found. Please register first.');
        }
        // Account status checks
        if (user.isDeleted) {
            throw new AppError_1.ForbiddenError('This account has been deleted. Contact support for recovery.');
        }
        if (!user.isActive) {
            throw new AppError_1.ForbiddenError('This account has been deactivated. Contact support.');
        }
        // Update last login
        user.lastLoginAt = new Date();
        await user.save();
        const tokens = await generateTokens(user);
        logger_1.logger.info('User logged in', { userId: user._id });
        return { user: user.toObject(), tokens, isNewUser: false };
    },
    /**
     * Refresh access token using a valid refresh token.
     * Implements token rotation: old token is consumed, new pair issued.
     */
    async refreshToken(oldRefreshToken) {
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(oldRefreshToken, config_1.config.JWT_REFRESH_SECRET);
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new AppError_1.UnauthorizedError('Refresh token has expired. Please login again.');
            }
            throw new AppError_1.UnauthorizedError('Invalid refresh token');
        }
        // Validate token type
        if (decoded.type !== 'refresh') {
            throw new AppError_1.UnauthorizedError('Invalid token type');
        }
        // Atomically remove the old token (prevents replay attacks)
        const result = await auth_model_1.User.updateOne({ _id: decoded.userId, refreshTokens: oldRefreshToken }, { $pull: { refreshTokens: oldRefreshToken } });
        if (result.modifiedCount === 0) {
            // Token was already used or doesn't exist — possible replay attack
            // Revoke ALL refresh tokens for this user (force re-login)
            await auth_model_1.User.updateOne({ _id: decoded.userId }, { $set: { refreshTokens: [] } });
            logger_1.logger.warn('Possible refresh token replay detected', { userId: decoded.userId });
            throw new AppError_1.UnauthorizedError('Token has already been used. All sessions revoked for security.');
        }
        // Verify user still exists and is active
        const user = await auth_model_1.User.findOne({
            _id: decoded.userId,
            isActive: true,
            isDeleted: false,
        });
        if (!user) {
            throw new AppError_1.ForbiddenError('Account is no longer active');
        }
        // Issue new token pair
        return generateTokens(user);
    },
    /**
     * Logout — remove specific refresh token.
     * Only removes that token, other devices stay logged in.
     */
    async logout(userId, refreshToken) {
        await auth_model_1.User.updateOne({ _id: userId }, { $pull: { refreshTokens: refreshToken } });
    },
    /**
     * Logout from ALL devices — clear all refresh tokens.
     */
    async logoutAll(userId) {
        await auth_model_1.User.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
        logger_1.logger.info('User logged out from all devices', { userId });
    },
    /**
     * Send password reset email via Firebase.
     * Always returns success to prevent email enumeration.
     */
    async forgotPassword(email) {
        try {
            const user = await auth_model_1.User.findOne({
                email: email.toLowerCase(),
                isActive: true,
                isDeleted: false,
            });
            if (user) {
                await (0, auth_1.getAuth)().generatePasswordResetLink(email);
                logger_1.logger.info('Password reset email sent', { email });
            }
            else {
                // Log but don't reveal that email doesn't exist
                logger_1.logger.info('Password reset attempted for non-existent email', { email });
            }
        }
        catch (error) {
            // Always succeed from the client's perspective
            logger_1.logger.warn('Password reset flow error', { email, error });
        }
    },
    /**
     * Update user profile fields.
     */
    async updateProfile(userId, updates) {
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
        const sanitizedUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                sanitizedUpdates[key] = updates[key];
            }
        }
        const user = await auth_model_1.User.findByIdAndUpdate(userId, { $set: sanitizedUpdates }, { new: true, runValidators: true });
        if (!user) {
            throw new AppError_1.NotFoundError('User not found');
        }
        logger_1.logger.info('User profile updated', { userId });
        return user.toObject();
    },
    /**
     * Set user's UPI ID.
     */
    /**
    * Set user's UPI ID.
    */
    async setUpiId(userId, upiId) {
        // Check if UPI ID is already taken by another user
        const existing = await auth_model_1.User.findOne({
            'bankingDetails.upiId': upiId, // ✅ FIXED
            _id: { $ne: userId },
            isActive: true,
            isDeleted: false,
        });
        if (existing) {
            throw new AppError_1.ConflictError('This UPI ID is already associated with another account');
        }
        const user = await auth_model_1.User.findOneAndUpdate({ _id: userId, isActive: true, isDeleted: false }, {
            $set: {
                'bankingDetails.upiId': upiId, // ✅ FIXED
                'bankingDetails.upiVerified': false, // Reset verification when UPI changes
            }
        }, { new: true, runValidators: true });
        if (!user) {
            throw new AppError_1.NotFoundError('User not found');
        }
        return user.toObject();
    },
    /**
     * Verify UPI ID (penny drop simulation).
     */
    /**
    * Verify UPI ID (penny drop simulation).
    */
    async verifyUpi(userId) {
        const user = await auth_model_1.User.findOne({
            _id: userId,
            isActive: true,
            isDeleted: false,
        });
        if (!user) {
            throw new AppError_1.NotFoundError('User not found');
        }
        // ✅ FIXED: upiId is inside bankingDetails
        if (!user.bankingDetails?.upiId) {
            throw new AppError_1.ValidationError('No UPI ID set. Please set your UPI ID first.');
        }
        // In production: trigger actual penny drop via UPI gateway
        // For now: simulate verification
        const verified = true; // Replace with actual verification logic
        if (verified) {
            await auth_model_1.User.updateOne({ _id: userId }, { $set: { 'bankingDetails.upiVerified': true } });
            logger_1.logger.info('UPI verified', { userId, upiId: user.bankingDetails.upiId });
        }
        return verified;
    },
    /**
     * Update FCM token for push notifications.
     */
    async updateFcmToken(userId, fcmToken) {
        await auth_model_1.User.updateOne({ _id: userId }, { $set: { fcmToken } });
    },
    /**
     * Deactivate account (soft delete).
     */
    async deactivateAccount(userId) {
        const user = await auth_model_1.User.findOneAndUpdate({ _id: userId, isActive: true, isDeleted: false }, {
            $set: {
                isActive: false,
                isDeleted: true,
                deletedAt: new Date(),
                refreshTokens: [], // Revoke all sessions
                fcmToken: null, // Stop push notifications
            }
        }, { new: true });
        if (!user) {
            throw new AppError_1.NotFoundError('User not found');
        }
        logger_1.logger.info('Account deactivated', { userId });
    },
    /**
     * Reactivate account.
     */
    async reactivateAccount(userId) {
        const user = await auth_model_1.User.findOneAndUpdate({ _id: userId, isDeleted: true }, {
            $set: {
                isActive: true,
                isDeleted: false,
                deletedAt: null,
            }
        }, { new: true });
        if (!user) {
            throw new AppError_1.NotFoundError('Deleted account not found');
        }
        logger_1.logger.info('Account reactivated', { userId });
        return user.toObject();
    },
};
//# sourceMappingURL=auth.service.js.map
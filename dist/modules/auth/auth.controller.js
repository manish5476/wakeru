"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const auth_model_1 = require("./auth.model");
const AppError_1 = require("../../shared/errors/AppError");
class AuthController {
    // ============================================================
    // Public Endpoints
    // ============================================================
    /**
     * POST /api/v1/auth/register
     * Register new user with Firebase ID token.
     */
    async register(req, res, next) {
        try {
            const { idToken, metadata } = req.body;
            const { user, tokens, isNewUser } = await auth_service_1.AuthService.register(idToken, metadata);
            const response = {
                success: true,
                message: 'Account created successfully',
                data: {
                    user: {
                        userId: user._id,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        role: user.role,
                    },
                    tokens,
                    isNewUser,
                },
                timestamp: new Date().toISOString(),
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/auth/login
     * Login with Firebase ID token.
     */
    async login(req, res, next) {
        try {
            const { idToken } = req.body;
            const { user, tokens, isNewUser } = await auth_service_1.AuthService.login(idToken);
            const response = {
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        userId: user._id,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        role: user.role,
                    },
                    tokens,
                    isNewUser,
                },
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/auth/forgot-password
     * Send password reset email via Firebase.
     * Always returns 200 to prevent email enumeration.
     */
    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            await auth_service_1.AuthService.forgotPassword(email);
            const response = {
                success: true,
                message: 'If an account exists for this email, reset instructions have been sent',
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/auth/refresh-token
     * Refresh access token using valid refresh token.
     */
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const tokens = await auth_service_1.AuthService.refreshToken(refreshToken);
            const response = {
                success: true,
                message: 'Token refreshed successfully',
                data: { tokens },
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================================
    // Authenticated Endpoints
    // ============================================================
    /**
     * POST /api/v1/auth/logout
     * Logout current device (remove specific refresh token).
     */
    async logout(req, res, next) {
        try {
            const { refreshToken } = req.body;
            await auth_service_1.AuthService.logout(req.user.userId, refreshToken);
            const response = {
                success: true,
                message: 'Logged out successfully',
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/auth/logout-all
     * Logout from ALL devices.
     */
    async logoutAll(req, res, next) {
        try {
            await auth_service_1.AuthService.logoutAll(req.user.userId);
            const response = {
                success: true,
                message: 'Logged out from all devices successfully',
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/v1/auth/me
     * Get current user's full profile.
     */
    async getProfile(req, res, next) {
        try {
            const user = await auth_model_1.User.findOne({
                _id: req.user.userId,
                isActive: true,
                isDeleted: false,
            });
            if (!user) {
                throw new AppError_1.NotFoundError('User not found');
            }
            const response = {
                success: true,
                message: 'Profile fetched successfully',
                data: { user: user.toObject() },
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /api/v1/auth/me
     * Update current user's profile.
     */
    async updateProfile(req, res, next) {
        try {
            const user = await auth_service_1.AuthService.updateProfile(req.user.userId, req.body);
            const response = {
                success: true,
                message: 'Profile updated successfully',
                data: { user },
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PUT /api/v1/auth/me/upi
     * Set/Update UPI ID.
     */
    async setUpiId(req, res, next) {
        try {
            const { upiId } = req.body;
            const user = await auth_service_1.AuthService.setUpiId(req.user.userId, upiId);
            const response = {
                success: true,
                message: 'UPI ID updated successfully',
                data: { user },
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/auth/me/upi/verify
     * Verify UPI ID.
     */
    async verifyUpi(req, res, next) {
        try {
            const verified = await auth_service_1.AuthService.verifyUpi(req.user.userId);
            const response = {
                success: true,
                message: verified ? 'UPI ID verified successfully' : 'UPI verification failed',
                data: { upiVerified: verified },
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PUT /api/v1/auth/me/fcm-token
     * Update FCM token for push notifications.
     */
    async updateFcmToken(req, res, next) {
        try {
            const { fcmToken } = req.body;
            await auth_service_1.AuthService.updateFcmToken(req.user.userId, fcmToken);
            const response = {
                success: true,
                message: 'FCM token updated',
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /api/v1/auth/me
     * Deactivate/delete account.
     */
    async deleteAccount(req, res, next) {
        try {
            await auth_service_1.AuthService.deactivateAccount(req.user.userId);
            const response = {
                success: true,
                message: 'Account deleted successfully',
                timestamp: new Date().toISOString(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map
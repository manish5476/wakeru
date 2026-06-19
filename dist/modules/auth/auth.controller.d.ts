import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class AuthController {
    /**
     * POST /api/v1/auth/register
     * Register new user with Firebase ID token.
     */
    register(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/login
     * Login with Firebase ID token.
     */
    login(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/forgot-password
     * Send password reset email via Firebase.
     * Always returns 200 to prevent email enumeration.
     */
    forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/refresh-token
     * Refresh access token using valid refresh token.
     */
    refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/logout
     * Logout current device (remove specific refresh token).
     */
    logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/logout-all
     * Logout from ALL devices.
     */
    logoutAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/v1/auth/me
     * Get current user's full profile.
     */
    getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /api/v1/auth/me
     * Update current user's profile.
     */
    updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/v1/auth/me/upi
     * Set/Update UPI ID.
     */
    setUpiId(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/me/upi/verify
     * Verify UPI ID.
     */
    verifyUpi(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/v1/auth/me/fcm-token
     * Update FCM token for push notifications.
     */
    updateFcmToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/v1/auth/me
     * Deactivate/delete account.
     */
    deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const authController: AuthController;
//# sourceMappingURL=auth.controller.d.ts.map
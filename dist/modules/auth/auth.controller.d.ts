import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class AuthController {
    /**
     * Register new user
     */
    register(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Login user
     */
    login(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Google OAuth login
     */
    googleAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Apple OAuth login
     */
    appleAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Refresh access token
     */
    refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Logout user
     */
    logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Verify email
     */
    /**
     * Forgot password
     */
    forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Reset password
     */
    resetPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Change password
     */
    changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get current user profile
     */
    getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const authController: AuthController;
//# sourceMappingURL=auth.controller.d.ts.map
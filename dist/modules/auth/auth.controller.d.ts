import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class AuthController {
    /**
     * Register a new user
     */
    register(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Login existing user
     */
    login(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Handle forgot password hook
     */
    forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Refresh access token
     */
    refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Logout user
     */
    logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get current user profile
     */
    getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const authController: AuthController;
//# sourceMappingURL=auth.controller.d.ts.map
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class UserController {
    /**
     * Get user profile
     */
    getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user by ID (public profile)
     */
    getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update profile
     */
    updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update preferences
     */
    updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update banking details
     */
    updateBankingDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Upload profile picture
     */
    uploadProfilePicture(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Delete account
     */
    deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Deactivate account
     */
    deactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Reactivate account
     */
    reactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Search users
     */
    searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user stats
     */
    getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get linked accounts
     */
    getLinkedAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Upgrade user role (admin only)
     */
    upgradeRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const userController: UserController;
//# sourceMappingURL=user.controller.d.ts.map
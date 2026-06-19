import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class UserController {
    getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getPublicProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    updateBankingDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    uploadProfilePicture(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    deactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    reactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getLinkedAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    upgradeRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const userController: UserController;
//# sourceMappingURL=user.controller.d.ts.map
import { IUserDocument } from './user.model';
import { UpdateUserDTO } from '../../shared/types/user.types';
export declare class UserService {
    /**
     * Get user by ID
     */
    getUserById(userId: string): Promise<IUserDocument>;
    /**
     * Update user profile
     */
    updateProfile(userId: string, updateData: UpdateUserDTO): Promise<IUserDocument>;
    /**
     * Update user preferences
     */
    updatePreferences(userId: string, preferences: any): Promise<IUserDocument>;
    /**
     * Update banking details
     */
    updateBankingDetails(userId: string, bankingDetails: any): Promise<IUserDocument>;
    /**
     * Upload profile picture
     */
    uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string>;
    /**
     * Delete account (soft delete)
     */
    deleteAccount(userId: string): Promise<void>;
    /**
     * Deactivate account
     */
    deactivateAccount(userId: string): Promise<IUserDocument>;
    /**
     * Reactivate account
     */
    reactivateAccount(userId: string): Promise<IUserDocument>;
    /**
     * Search users
     */
    searchUsers(query: string, page?: number, limit?: number): Promise<{
        users: IUserDocument[];
        total: number;
    }>;
    /**
     * Get user stats
     */
    getUserStats(userId: string): Promise<any>;
    /**
     * Get user's public profile
     */
    getPublicProfile(userId: string): Promise<Partial<IUserDocument>>;
    /**
     * Upgrade user role
     */
    upgradeRole(userId: string, newRole: string): Promise<IUserDocument>;
    /**
     * Get user's linked accounts
     */
    getLinkedAccounts(userId: string): Promise<any>;
}
export declare const userService: UserService;
//# sourceMappingURL=user.service.d.ts.map
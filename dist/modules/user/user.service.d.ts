import { IUserDocument } from '../auth/auth.model';
interface PaginatedUserSearchResult {
    users: Partial<IUserDocument>[];
    total: number;
    page: number;
    limit: number;
}
export declare class UserService {
    /**
     * Get user by ID (with cache)
     */
    getUserById(userId: string): Promise<IUserDocument>;
    /**
     * Get public profile
     */
    getPublicProfile(userId: string): Promise<Record<string, any>>;
    /**
     * Update profile
     */
    updateProfile(userId: string, updateData: Record<string, any>): Promise<IUserDocument>;
    /**
     * Update preferences
     */
    updatePreferences(userId: string, preferences: Record<string, any>): Promise<IUserDocument>;
    /**
     * Update banking details
     */
    updateBankingDetails(userId: string, bankingDetails: Record<string, any>): Promise<IUserDocument>;
    /**
     * Upload profile picture
     */
    uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string>;
    /**
     * Delete account (soft delete and remove from Firebase)
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
    searchUsers(query: string, page?: number, limit?: number): Promise<PaginatedUserSearchResult>;
    /**
     * Get user stats
     */
    getUserStats(userId: string): Promise<{
        totalGroups: any;
        totalExpenses: any;
        totalSettled: any;
        totalPending: any;
        totalOwedAcrossTrips: any;
        totalLentAcrossTrips: any;
        netBalance: number;
        lastActiveAt: any;
        memberSince: any;
        role: any;
    }>;
    /**
     * Get linked accounts
     */
    getLinkedAccounts(userId: string): Promise<Record<string, any>>;
    /**
     * Upgrade user role (admin only)
     */
    upgradeRole(userId: string, newRole: string): Promise<IUserDocument>;
}
export declare const userService: UserService;
export {};
//# sourceMappingURL=user.service.d.ts.map
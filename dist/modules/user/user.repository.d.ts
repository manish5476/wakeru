import { IUserDocument } from './user.model';
import { UpdateUserDTO } from '../../shared/types/user.types';
export declare class UserRepository {
    findById(userId: string): Promise<IUserDocument | null>;
    findByEmail(email: string): Promise<IUserDocument | null>;
    findByPhone(phoneNumber: string): Promise<IUserDocument | null>;
    updateUser(userId: string, updateData: UpdateUserDTO): Promise<IUserDocument | null>;
    updatePreferences(userId: string, preferences: any): Promise<IUserDocument | null>;
    updateBankingDetails(userId: string, bankingDetails: any): Promise<IUserDocument | null>;
    updateProfilePicture(userId: string, profilePicture: string): Promise<IUserDocument | null>;
    softDelete(userId: string): Promise<void>;
    deactivateAccount(userId: string): Promise<IUserDocument | null>;
    reactivateAccount(userId: string): Promise<IUserDocument | null>;
    searchUsers(query: string, limit?: number): Promise<IUserDocument[]>;
    getUsersByIds(userIds: string[]): Promise<IUserDocument[]>;
    updateStats(userId: string, stats: Partial<IUserDocument['stats']>): Promise<void>;
    getActiveUsersCount(): Promise<number>;
    getUsersByRole(role: string): Promise<IUserDocument[]>;
}
export declare const userRepository: UserRepository;
//# sourceMappingURL=user.repository.d.ts.map
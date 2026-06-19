import { Document, Model } from 'mongoose';
export interface IAuthProviders {
    google?: {
        id: string;
        email: string;
    };
    apple?: {
        id: string;
        email: string;
    };
    email?: {
        verified: boolean;
        verificationToken?: string;
        verificationExpires?: Date;
    };
}
export interface INotificationPreferences {
    push: boolean;
    email: boolean;
    sms: boolean;
    expenseAdded: boolean;
    settlementReminder: boolean;
    monthlyReport: boolean;
}
export interface IUserPreferences {
    defaultCurrency: string;
    language: string;
    theme: 'light' | 'dark' | 'system';
    timezone: string;
    notifications: INotificationPreferences;
}
export interface IBankingDetails {
    upiId?: string;
    upiVerified?: boolean;
    bankAccount?: {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        accountHolderName: string;
    };
    walletDetails?: {
        provider: 'paytm' | 'phonepe' | 'googlepay' | 'amazonpay';
        walletId: string;
    };
}
export interface IUserStats {
    totalGroups: number;
    totalExpenses: number;
    totalSettled: number;
    totalPending: number;
    lastActiveAt: Date;
    accountCreatedAt: Date;
}
export interface IUser {
    [x: string]: any;
    _id: string;
    firebaseUid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    phoneNumber?: string;
    bio?: string;
    role: 'user' | 'premium' | 'business' | 'admin';
    authProviders: IAuthProviders;
    refreshTokens: string[];
    lastLoginAt?: Date;
    isActive: boolean;
    isDeleted: boolean;
    deletedAt?: Date;
    totalOwedAcrossTrips: number;
    totalLentAcrossTrips: number;
    friendIds: string[];
    fcmToken?: string;
    preferences: IUserPreferences;
    bankingDetails: IBankingDetails;
    stats: IUserStats;
    createdAt: Date;
    updatedAt: Date;
}
export interface IUserDocument extends Omit<IUser, '_id'>, Document<string, any, IUser> {
    _id: string;
    toPublicProfile(): Record<string, any>;
    toFullProfile(): Record<string, any>;
}
export interface IUserModel extends Model<IUserDocument> {
    findActive(identifier: string): Promise<IUserDocument | null>;
    findByFirebaseUid(uid: string): Promise<IUserDocument | null>;
    findByEmail(email: string): Promise<IUserDocument | null>;
}
declare const UserModel: IUserModel;
export { UserModel as User };
//# sourceMappingURL=auth.model.d.ts.map
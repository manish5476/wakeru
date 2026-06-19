export interface IUser {
    userId: string;
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    displayName: string;
    phoneNumber?: string;
    profilePicture?: string;
    authProviders: {
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
        };
    };
    preferences: {
        defaultCurrency: string;
        language: string;
        notificationPreferences: {
            email: boolean;
            push: boolean;
            sms: boolean;
            expenseReminders: boolean;
            settlementReminders: boolean;
            monthlyReports: boolean;
        };
        theme: 'light' | 'dark' | 'system';
        timezone: string;
    };
    bankingDetails?: {
        upiId?: string;
        upiVerified?: boolean;
        bankAccount?: {
            accountNumber: string;
            ifscCode: string;
            bankName: string;
            accountHolderName: string;
        };
        walletDetails?: {
            provider: string;
            walletId: string;
        };
    };
    stats: {
        totalGroups: number;
        totalExpenses: number;
        totalSettled: number;
        totalPending: number;
        lastActiveAt: Date;
        accountCreatedAt: Date;
    };
    isActive: boolean;
    isDeleted: boolean;
    isVerified: boolean;
    role: 'user' | 'premium' | 'business' | 'admin';
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}
export interface CreateUserDTO {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    defaultCurrency?: string;
}
export interface UpdateUserDTO {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    profilePicture?: string;
    preferences?: Partial<IUser['preferences']>;
    bankingDetails?: IUser['bankingDetails'];
}
export interface UserLoginDTO {
    email: string;
    password: string;
}
export interface UserResponse {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    phoneNumber?: string;
    profilePicture?: string;
    preferences: IUser['preferences'];
    stats: IUser['stats'];
    role: string;
    isVerified: boolean;
    createdAt: Date;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
//# sourceMappingURL=user.types.d.ts.map
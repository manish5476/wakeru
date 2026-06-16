import { IUser } from './auth.model';
export declare const AuthService: {
    register(userData: Partial<IUser>): Promise<IUser>;
    login(email: string, password: string): Promise<{
        user: IUser;
        tokens: any;
    }>;
    googleAuth(googleToken: string): Promise<{
        user: IUser;
        tokens: any;
        isNewUser: boolean;
    }>;
    appleAuth(appleToken: string, extraData: {
        firstName?: string;
        lastName?: string;
    }): Promise<{
        user: IUser;
        tokens: any;
        isNewUser: boolean;
    }>;
    refreshToken(refreshToken: string): Promise<any>;
    logout(userId: string, refreshToken: string): Promise<void>;
    verifyEmail(token: string): Promise<void>;
    forgotPassword(email: string): Promise<void>;
    resetPassword(token: string, newPassword: string): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
};
//# sourceMappingURL=auth.service.d.ts.map
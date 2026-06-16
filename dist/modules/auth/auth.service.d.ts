import { IUser } from './auth.model';
export declare const AuthService: {
    register(idToken: string, metadata?: any): Promise<{
        user: IUser;
        tokens: any;
    }>;
    login(idToken: string): Promise<{
        user: IUser;
        tokens: any;
    }>;
    refreshToken(refreshToken: string): Promise<any>;
    logout(userId: string, refreshToken: string): Promise<void>;
};
//# sourceMappingURL=auth.service.d.ts.map
import { IUser } from './auth.model';
interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
interface AuthResult {
    user: IUser;
    tokens: TokenPair;
    isNewUser: boolean;
}
export declare const AuthService: {
    /**
     * Register a new user using Firebase ID token.
     * Creates user document + returns JWT pair.
     */
    register(idToken: string, metadata?: {
        displayName?: string;
        phoneNumber?: string;
        photoURL?: string;
    }): Promise<AuthResult>;
    /**
     * Login existing user with Firebase ID token.
     * Links Firebase UID to email-based account if not already linked.
     */
    login(idToken: string): Promise<AuthResult>;
    /**
     * Refresh access token using a valid refresh token.
     * Implements token rotation: old token is consumed, new pair issued.
     */
    refreshToken(oldRefreshToken: string): Promise<TokenPair>;
    /**
     * Logout — remove specific refresh token.
     * Only removes that token, other devices stay logged in.
     */
    logout(userId: string, refreshToken: string): Promise<void>;
    /**
     * Logout from ALL devices — clear all refresh tokens.
     */
    logoutAll(userId: string): Promise<void>;
    /**
     * Send password reset email via Firebase.
     * Always returns success to prevent email enumeration.
     */
    forgotPassword(email: string): Promise<void>;
    /**
     * Update user profile fields.
     */
    updateProfile(userId: string, updates: Record<string, any>): Promise<IUser>;
    /**
     * Set user's UPI ID.
     */
    /**
    * Set user's UPI ID.
    */
    setUpiId(userId: string, upiId: string): Promise<IUser>;
    /**
     * Verify UPI ID (penny drop simulation).
     */
    /**
    * Verify UPI ID (penny drop simulation).
    */
    verifyUpi(userId: string): Promise<boolean>;
    /**
     * Update FCM token for push notifications.
     */
    updateFcmToken(userId: string, fcmToken: string): Promise<void>;
    /**
     * Deactivate account (soft delete).
     */
    deactivateAccount(userId: string): Promise<void>;
    /**
     * Reactivate account.
     */
    reactivateAccount(userId: string): Promise<IUser>;
};
export {};
//# sourceMappingURL=auth.service.d.ts.map
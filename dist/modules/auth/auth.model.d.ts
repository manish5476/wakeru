import { Document } from 'mongoose';
export interface IUser extends Document {
    userId: string;
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role: string;
    phoneNumber?: string;
    profilePictureUrl?: string;
    bio?: string;
    authProviders: {
        google?: {
            id: string;
        };
        apple?: {
            id: string;
        };
    };
    preferences: Map<string, any>;
    refreshTokens?: string[];
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    isVerified: boolean;
    isActive: boolean;
    isDeleted: boolean;
    comparePassword(password: string): Promise<boolean>;
    generateVerificationToken(): string;
}
export declare const User: import("mongoose").Model<IUser, {}, {}, {}, Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=auth.model.d.ts.map
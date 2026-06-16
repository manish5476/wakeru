import { Document } from 'mongoose';
export interface IUser extends Document {
    userId: string;
    firebaseUid: string;
    email: string;
    displayName: string;
    role: string;
    phoneNumber?: string;
    profilePictureUrl?: string;
    bio?: string;
    upiId?: string;
    preferences: Map<string, any>;
    refreshTokens?: string[];
    isActive: boolean;
    isDeleted: boolean;
}
export declare const User: import("mongoose").Model<IUser, {}, {}, {}, Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=auth.model.d.ts.map
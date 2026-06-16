import mongoose, { Document } from 'mongoose';
import { IUser } from '../../shared/types/user.types';
export interface IUserDocument extends IUser, Document {
}
export declare const UserModel: mongoose.Model<any, {}, {}, {}, any, any>;
//# sourceMappingURL=user.model.d.ts.map
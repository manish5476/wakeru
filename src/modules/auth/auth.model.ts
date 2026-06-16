import { Schema, model, Document } from 'mongoose';

// Define the interface for the User document
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

const userSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true },
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    displayName: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    phoneNumber: { type: String, index: true },
    profilePictureUrl: { type: String },
    bio: { type: String },
    upiId: { type: String },
    preferences: { type: Map, of: Schema.Types.Mixed, default: {} },
    refreshTokens: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false
  }
);

// Securely serialize user data
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.refreshTokens;
    return ret;
  },
});

export const User = model<IUser>('User', userSchema);

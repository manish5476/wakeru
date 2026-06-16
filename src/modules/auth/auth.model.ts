import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Define the interface for the User document
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
  authProviders: { provider: string; providerId: string }[];
  preferences: Map<string, any>;
  refreshTokens?: string[];
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  isEmailVerified: boolean;

  // Methods
  comparePassword(password: string): Promise<boolean>;
  generateVerificationToken(): string;
}

const userSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    phoneNumber: { type: String },
    profilePictureUrl: { type: String },
    bio: { type: String },
    authProviders: [
      {
        provider: { type: String, required: true },
        providerId: { type: String, required: true },
      },
    ],
    preferences: { type: Map, of: Schema.Types.Mixed },
    refreshTokens: [{ type: String }],
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    emailVerificationToken: { type: String },
    isEmailVerified: { type: Boolean, default: false },
  },
  { 
    timestamps: true, 
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true },
    versionKey: false // Prevent __v from being added to documents
  }
);

// Pre-save hook to hash password
userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare entered password with the hashed password
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password || '');
};

// Method to generate email verification token
userSchema.methods.generateVerificationToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  return token;
};

// Securely serialize user data
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.emailVerificationToken;
    // __v is no longer present, so no need to delete it
    return ret;
  },
});

export const User = model<IUser>('User', userSchema);

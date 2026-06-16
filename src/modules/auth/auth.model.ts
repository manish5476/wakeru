import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Interface for the User document
export interface IUser extends Document {
  userId: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  bio?: string;
  
  authProviders: {
    google?: { id: string; email?: string };
    apple?: { id: string; email?: string };
    facebook?: { id: string; email?: string };
  };
  
  preferences: {
    currency: string;
    language: string;
    timeZone: string;
    notificationSettings: {
      push: boolean;
      email: boolean;
      sms: boolean;
    };
  };
  
  refreshTokens: Array<{
    token: string;
    expiresAt: Date;
    deviceInfo?: string;
    ipAddress?: string;
  }>;
  
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  
  activityLog: Array<{
    timestamp: Date;
    activity: string;
    ipAddress?: string;
    deviceInfo?: string;
  }>;

  accountStatus: {
    lastActiveAt: Date;
  };
  
  isActive: boolean;
  isDeleted: boolean;
  isVerified: boolean;
  role: 'user' | 'premium' | 'business' | 'admin';
  
  lastLoginAt?: Date;

  // Method signatures for TypeScript
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateVerificationToken(): string;
}

// Mongoose Schema for the User
const UserSchema = new Schema<IUser>({
  userId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `usr_${crypto.randomBytes(16).toString('hex')}`
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { type: String, select: false },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phoneNumber: { type: String, trim: true },
  profilePictureUrl: String,
  bio: String,
  
  authProviders: {
    google: { id: String, email: String },
    apple: { id: String, email: String },
    facebook: { id: String, email: String }
  },
  
  preferences: {
    currency: { type: String, default: 'USD' },
    language: { type: String, default: 'en' },
    timeZone: { type: String, default: 'UTC' },
    notificationSettings: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    }
  },
  
  refreshTokens: [{
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    deviceInfo: String,
    ipAddress: String
  }],
  
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  emailVerificationToken: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  
  activityLog: [{
    timestamp: { type: Date, default: Date.now },
    activity: String,
    ipAddress: String,
    deviceInfo: String
  }],

  accountStatus: {
    lastActiveAt: { type: Date, default: Date.now }
  },
  
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  role: { 
    type: String, 
    enum: ['user', 'premium', 'business', 'admin'],
    default: 'user'
  },
  
  lastLoginAt: Date,
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      const retAny = ret as any;
      delete retAny.password;
      delete retAny.refreshTokens;
      delete retAny.passwordResetToken;
      delete retAny.passwordResetExpires;
      delete retAny.emailVerificationToken;
      delete retAny.emailVerificationExpires;
      delete retAny.__v;
      return retAny;
    }
  }
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ userId: 1 });

// Pre-save hook to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

// Method to compare password for login
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate email verification token
UserSchema.methods.generateVerificationToken = function(): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = token;
  this.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return token;
};

export const User = mongoose.model<IUser>('User', UserSchema);

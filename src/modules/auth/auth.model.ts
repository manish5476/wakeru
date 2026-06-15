import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IUser extends Document {
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
      verificationExpires?: Date;
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
  
  stats: {
    totalGroups: number;
    totalExpenses: number;
    totalSettled: mongoose.Types.Decimal128;
    totalPending: mongoose.Types.Decimal128;
    lastActiveAt: Date;
  };
  
  isActive: boolean;
  isDeleted: boolean;
  isVerified: boolean;
  role: 'user' | 'premium' | 'business' | 'admin';
  
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateVerificationToken(): string;
  generatePasswordResetToken(): string;
}

const UserSchema = new Schema<IUser>({
  userId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => crypto.randomUUID()
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Invalid email format'
    }
  },
  password: { 
    type: String,
    select: false,
    minlength: 8
  },
  firstName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  displayName: { type: String },
  phoneNumber: { type: String },
  profilePicture: { type: String },
  
  authProviders: {
    google: {
      id: String,
      email: String
    },
    apple: {
      id: String,
      email: String
    },
    email: {
      verified: { type: Boolean, default: false },
      verificationToken: String,
      verificationExpires: Date
    }
  },
  
  refreshTokens: [{
    token: String,
    expiresAt: Date,
    deviceInfo: String,
    ipAddress: String
  }],
  
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  preferences: {
    defaultCurrency: { type: String, default: 'INR' },
    language: { type: String, default: 'en' },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      expenseReminders: { type: Boolean, default: true },
      settlementReminders: { type: Boolean, default: true },
      monthlyReports: { type: Boolean, default: true }
    },
    theme: { 
      type: String, 
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    timezone: { type: String, default: 'Asia/Kolkata' }
  },
  
  stats: {
    totalGroups: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    totalSettled: { type: Schema.Types.Decimal128, default: 0 },
    totalPending: { type: Schema.Types.Decimal128, default: 0 },
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
      delete ret.password;
      delete ret.refreshTokens;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ userId: 1 });
UserSchema.index({ 'authProviders.google.id': 1 });
UserSchema.index({ 'authProviders.apple.id': 1 });

// Pre-save hook to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Generate display name if not set
    if (!this.displayName) {
      this.displayName = `${this.firstName} ${this.lastName}`;
    }
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance methods
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.generateVerificationToken = function(): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.authProviders.email = {
    ...this.authProviders.email,
    verificationToken: crypto.createHash('sha256').update(token).digest('hex'),
    verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
  return token;
};

UserSchema.methods.generatePasswordResetToken = function(): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return token;
};

export const User = mongoose.model<IUser>('User', UserSchema);
import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../../shared/types/user.types';

export interface IUserDocument extends IUser, Document {}

const UserSchema = new Schema<IUserDocument>({
  userId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  firstName: { 
    type: String, 
    required: true,
    trim: true
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true
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
  
  bankingDetails: {
    upiId: String,
    bankAccount: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      accountHolderName: String
    },
    walletDetails: {
      provider: String,
      walletId: String
    }
  },
  
  stats: {
    totalGroups: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    totalSettled: { type: Number, default: 0 },
    totalPending: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
    accountCreatedAt: { type: Date, default: Date.now }
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
    virtuals: true,
    transform: (doc, ret: { [key: string]: any }) => {
      delete ret.__v;
      delete ret._id;
      return ret;
    }
  }
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ 'preferences.defaultCurrency': 1 });

export const UserModel = mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
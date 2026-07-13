import mongoose, { Schema, Document, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Interfaces
// ============================================================

export interface IAuthProviders {
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
}

export interface INotificationPreferences {
  push: boolean;
  email: boolean;
  sms: boolean;
  expenseAdded: boolean;
  settlementReminder: boolean;
  monthlyReport: boolean;
}

export interface IAppearancePreferences {
  themePreset?: string;
  backgroundType: 'color' | 'image';
  backgroundColor: string | null;
  backgroundImage: string | null;
  backgroundBlur: number;
  backgroundImagePosition: { x: number; y: number; scale: number };
}

export interface IUserPreferences {
  defaultCurrency: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  notifications: INotificationPreferences;
  appearance?: IAppearancePreferences;
}

export interface IBankingDetails {
  upiId?: string;
  upiVerified?: boolean;
  bankAccount?: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    accountHolderName: string;
  };
  walletDetails?: {
    provider: 'paytm' | 'phonepe' | 'googlepay' | 'amazonpay';
    walletId: string;
  };
}

export interface IUserStats {
  totalGroups: number;
  totalExpenses: number;
  totalSettled: number;
  totalPending: number;
  lastActiveAt: Date;
  accountCreatedAt: Date;
}

// Clean interface without Mongoose internals
export interface IUser {
  [x: string]: any;
  _id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  bio?: string;

  role: 'user' | 'premium' | 'business' | 'admin';
  authProviders: IAuthProviders;
  refreshTokens: {
    token: string;
    device: string;
    ip: string;
    lastActive: Date;
  }[];
  lastLoginAt?: Date;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;

  totalOwedAcrossTrips: number;
  totalLentAcrossTrips: number;

  friendIds: string[];
  fcmTokens: string[];

  preferences: IUserPreferences;
  bankingDetails: IBankingDetails;
  stats: IUserStats;

  passwordResetStats?: {
    count: number;
    lastRequestAt: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Document — resolves _id type conflict
export interface IUserDocument extends Omit<IUser, '_id'>, Document<string, any, IUser> {
  _id: string;
  toPublicProfile(): Record<string, any>;
  toFullProfile(): Record<string, any>;
}

// Model with static methods
export interface IUserModel extends Model<IUserDocument> {
  findActive(identifier: string): Promise<IUserDocument | null>;
  findByFirebaseUid(uid: string): Promise<IUserDocument | null>;
  findByEmail(email: string): Promise<IUserDocument | null>;
}

// ============================================================
// Sub-Schemas
// ============================================================

const NotificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    expenseAdded: { type: Boolean, default: true },
    settlementReminder: { type: Boolean, default: true },
    monthlyReport: { type: Boolean, default: true },
  },
  { _id: false }
);

const AppearancePreferencesSchema = new Schema<IAppearancePreferences>(
  {
    themePreset: { type: String, default: 'light' },
    backgroundType: { type: String, enum: ['color', 'image'], default: 'color' },
    backgroundColor: { type: String, default: null },
    backgroundImage: { type: String, default: null },
    backgroundBlur: { type: Number, default: 50 },
    backgroundImagePosition: {
      type: new Schema(
        {
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 },
          scale: { type: Number, default: 1 },
        },
        { _id: false }
      ),
      default: () => ({ x: 0, y: 0, scale: 1 })
    },
  },
  { _id: false }
);

const UserPreferencesSchema = new Schema<IUserPreferences>(
  {
    defaultCurrency: { type: String, default: 'INR' },
    language: { type: String, default: 'en' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    notifications: {
      type: NotificationPreferencesSchema,
      default: () => ({
        push: true,
        email: true,
        sms: false,
        expenseAdded: true,
        settlementReminder: true,
        monthlyReport: true,
      })
    },
    appearance: {
      type: AppearancePreferencesSchema,
      default: () => ({
        themePreset: 'light',
        backgroundType: 'color',
        backgroundColor: null,
        backgroundImage: null,
        backgroundBlur: 50,
        backgroundImagePosition: { x: 0, y: 0, scale: 1 }
      })
    },
  },
  { _id: false }
);

const AuthProvidersSchema = new Schema<IAuthProviders>(
  {
    google: {
      type: new Schema(
        { id: String, email: String },
        { _id: false }
      ),
    },
    apple: {
      type: new Schema(
        { id: String, email: String },
        { _id: false }
      ),
    },
    email: {
      type: new Schema(
        {
          verified: { type: Boolean, default: false },
          verificationToken: String,
          verificationExpires: Date,
        },
        { _id: false }
      ),
      default: () => ({ verified: false }),
    },
  },
  { _id: false }
);

const BankingDetailsSchema = new Schema<IBankingDetails>(
  {
    upiId: { type: String, sparse: true },
    upiVerified: { type: Boolean, default: false },
    bankAccount: {
      type: new Schema(
        {
          accountNumber: String,
          ifscCode: String,
          bankName: String,
          accountHolderName: String,
        },
        { _id: false }
      ),
    },
    walletDetails: {
      type: new Schema(
        {
          provider: {
            type: String,
            enum: ['paytm', 'phonepe', 'googlepay', 'amazonpay']
          },
          walletId: String,
        },
        { _id: false }
      ),
    },
  },
  { _id: false }
);

const UserStatsSchema = new Schema<IUserStats>(
  {
    totalGroups: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    totalSettled: { type: Number, default: 0 },
    totalPending: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
    accountCreatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SessionSchema = new Schema(
  {
    token: { type: String, required: true },
    device: { type: String, default: 'Unknown Device' },
    ip: { type: String, default: 'Unknown IP' },
    lastActive: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ============================================================
// Main User Schema
// ============================================================

const UserSchema = new Schema<IUserDocument, IUserModel>(
  {
    _id: {
      type: String,
      default: () => uuidv4() // Use function to generate new UUID each time
    },
    firebaseUid: {
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
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    photoURL: { type: String },
    phoneNumber: {
      type: String,
      index: true,
      sparse: true
    },
    bio: {
      type: String,
      maxlength: 500
    },

    // Role & Auth
    role: {
      type: String,
      enum: ['user', 'premium', 'business', 'admin'],
      default: 'user',
    },
    authProviders: {
      type: AuthProvidersSchema,
      default: () => ({})
    },
    refreshTokens: {
      type: [SessionSchema],
      default: () => []
    },
    lastLoginAt: { type: Date },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // TripSplit — Cross-Trip Aggregates
    totalOwedAcrossTrips: {
      type: Number,
      default: 0,
      min: 0
    },
    totalLentAcrossTrips: {
      type: Number,
      default: 0,
      min: 0
    },

    // Social
    friendIds: {
      type: [{ type: String }],
      default: [],
      index: true,
    },
    // Push Notifications
    fcmTokens: {
      type: [String],
      default: []
    },

    // Preferences & Banking
    preferences: {
      type: UserPreferencesSchema,
      default: () => ({})
    },
    bankingDetails: {
      type: BankingDetailsSchema,
      default: () => ({})
    },
    stats: {
      type: UserStatsSchema,
      default: () => ({})
    },
    passwordResetStats: {
      type: new Schema(
        {
          count: { type: Number, default: 0 },
          lastRequestAt: { type: Date, default: new Date() },
        },
        { _id: false }
      ),
      default: () => ({ count: 0, lastRequestAt: new Date() }),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      // ✅ FIX: Use destructuring instead of delete operator
      transform: (_doc: any, ret: Record<string, any>) => {
        const {
          refreshTokens,
          __v,
          fcmToken,
          authProviders,
          deletedAt,
          ...safeRet
        } = ret;
        return safeRet;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc: any, ret: Record<string, any>) => {
        const {
          refreshTokens,
          __v,
          fcmToken,
          authProviders,
          deletedAt,
          ...safeRet
        } = ret;
        return safeRet;
      },
    },
    versionKey: false,
  }
);

// ============================================================
// Indexes
// ============================================================

UserSchema.index({ email: 1 });
UserSchema.index({ phoneNumber: 1 }, { sparse: true });
UserSchema.index({ friendIds: 1 });
UserSchema.index({ isDeleted: 1, isActive: 1 });
UserSchema.index({ 'totalOwedAcrossTrips': -1 });
UserSchema.index({ 'totalLentAcrossTrips': -1 });

// ============================================================
// Pre-Save Middleware
// ============================================================

UserSchema.pre('save', function (next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  if (this.isModified('isDeleted') && this.isDeleted) {
    this.deletedAt = new Date();
  }
  next();
});

// ============================================================
// Virtuals
// ============================================================

UserSchema.virtual('netBalance').get(function () {
  return (this.totalLentAcrossTrips || 0) - (this.totalOwedAcrossTrips || 0);
});

UserSchema.virtual('friendCount').get(function () {
  return this.friendIds?.length || 0;
});

// ============================================================
// Instance Methods
// ============================================================

UserSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    displayName: this.displayName,
    photoURL: this.photoURL,
    bio: this.bio,
    stats: {
      totalGroups: this.stats?.totalGroups || 0,
      totalExpenses: this.stats?.totalExpenses || 0,
    },
  };
};

UserSchema.methods.toFullProfile = function () {
  // toJSON already strips sensitive fields
  const obj = this.toJSON();
  return obj;
};

// ============================================================
// Static Methods
// ============================================================

UserSchema.statics.findActive = function (identifier: string) {
  return this.findOne({
    $or: [
      { _id: identifier },
      { firebaseUid: identifier },
      { email: identifier.toLowerCase() },
    ],
    isActive: true,
    isDeleted: false,
  });
};

UserSchema.statics.findByFirebaseUid = function (uid: string) {
  return this.findOne({
    firebaseUid: uid,
    isDeleted: false
  });
};

UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({
    email: email.toLowerCase(),
    isDeleted: false
  });
};

// ============================================================
// Export
// ============================================================

// ============================================================
// Export
// ============================================================

// Use double-cast through unknown to resolve type mismatch
// mongoose.models.User is a generic Model at runtime but has our static methods
const UserModel = mongoose.models.User
  ? (mongoose.models.User as unknown as IUserModel)
  : mongoose.model<IUserDocument, IUserModel>('User', UserSchema);

export { UserModel as User };
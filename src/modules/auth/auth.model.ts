import mongoose, { Schema, Document, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Interfaces
// ============================================================

export interface IAuthProviders {
  google?: { id: string; email: string };
  apple?:  { id: string; email: string };
  email?:  {
    verified:             boolean;
    verificationToken?:   string;
    verificationExpires?: Date;
  };
}

export interface INotificationPreferences {
  push:               boolean;
  email:              boolean;
  sms:                boolean;
  expenseAdded:       boolean;
  settlementReminder: boolean;
  monthlyReport:      boolean;
}

export interface IUserPreferences {
  defaultCurrency: string;
  language:        string;
  theme:           'light' | 'dark' | 'system';
  timezone:        string;
  notifications:   INotificationPreferences;
}

export interface IBankingDetails {
  upiId?:       string;
  upiVerified?: boolean;
  bankAccount?: {
    accountNumber:     string;
    ifscCode:          string;
    bankName:          string;
    accountHolderName: string;
  };
  walletDetails?: {
    provider: 'paytm' | 'phonepe' | 'googlepay' | 'amazonpay';
    walletId: string;
  };
}

export interface IUserStats {
  totalGroups:      number;
  totalExpenses:    number;
  totalSettled:     number;
  totalPending:     number;
  lastActiveAt:     Date;
  accountCreatedAt: Date;
}

// Clean interface without Mongoose internals
export interface IUser {
  [x: string]: any;
  _id:         string;
  firebaseUid: string;
  email:       string;
  displayName: string;
  photoURL?:   string;
  phoneNumber?: string;
  bio?:        string;

  role: 'user' | 'premium' | 'business' | 'admin';

  // Token versioning — increment to invalidate ALL existing sessions.
  // Use on: password change, force-logout, suspicious activity, account deletion.
  tokenVersion: number;

  authProviders:  IAuthProviders;
  refreshTokens:  string[];
  lastLoginAt?:   Date;
  isActive:       boolean;
  isDeleted:      boolean;
  deletedAt?:     Date;

  // TripSplit — Cross-Trip Aggregates
  totalOwedAcrossTrips: number;
  totalLentAcrossTrips: number;

  // Social
  friendIds: string[];

  // Push Notifications
  fcmToken?: string;

  preferences:    IUserPreferences;
  bankingDetails: IBankingDetails;
  stats:          IUserStats;

  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Document — resolves _id type conflict
export interface IUserDocument
  extends Omit<IUser, '_id'>,
    Document<string, any, IUser> {
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
    push:               { type: Boolean, default: true  },
    email:              { type: Boolean, default: true  },
    sms:                { type: Boolean, default: false },
    expenseAdded:       { type: Boolean, default: true  },
    settlementReminder: { type: Boolean, default: true  },
    monthlyReport:      { type: Boolean, default: true  },
  },
  { _id: false }
);

const UserPreferencesSchema = new Schema<IUserPreferences>(
  {
    defaultCurrency: { type: String, default: 'INR' },
    language:        { type: String, default: 'en'  },
    theme: {
      type:    String,
      enum:    ['light', 'dark', 'system'],
      default: 'system',
    },
    timezone:      { type: String, default: 'Asia/Kolkata' },
    notifications: {
      type:    NotificationPreferencesSchema,
      default: () => ({
        push:               true,
        email:              true,
        sms:                false,
        expenseAdded:       true,
        settlementReminder: true,
        monthlyReport:      true,
      }),
    },
  },
  { _id: false }
);

const AuthProvidersSchema = new Schema<IAuthProviders>(
  {
    google: {
      type: new Schema({ id: String, email: String }, { _id: false }),
    },
    apple: {
      type: new Schema({ id: String, email: String }, { _id: false }),
    },
    email: {
      type: new Schema(
        {
          verified:            { type: Boolean, default: false },
          verificationToken:   String,
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
    upiId:       { type: String, sparse: true },
    upiVerified: { type: Boolean, default: false },
    bankAccount: {
      type: new Schema(
        {
          accountNumber:     String,
          ifscCode:          String,
          bankName:          String,
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
            enum: ['paytm', 'phonepe', 'googlepay', 'amazonpay'],
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
    totalGroups:      { type: Number, default: 0        },
    totalExpenses:    { type: Number, default: 0        },
    totalSettled:     { type: Number, default: 0        },
    totalPending:     { type: Number, default: 0        },
    lastActiveAt:     { type: Date,   default: Date.now },
    accountCreatedAt: { type: Date,   default: Date.now },
  },
  { _id: false }
);

// ============================================================
// Main User Schema
// ============================================================

const UserSchema = new Schema<IUserDocument, IUserModel>(
  {
    _id: { type: String, default: () => uuidv4() },

    firebaseUid: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
      index:     true,
    },

    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    photoURL:    { type: String },
    phoneNumber: { type: String, index: true, sparse: true },
    bio:         { type: String, maxlength: 500 },

    // Role & Auth
    role: {
      type:    String,
      enum:    ['user', 'premium', 'business', 'admin'],
      default: 'user',
    },

    // FIX: tokenVersion field — required for force-logout / session invalidation.
    // Increment via: User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } })
    tokenVersion: { type: Number, default: 0 },

    authProviders: { type: AuthProvidersSchema, default: () => ({}) },
    refreshTokens: [{ type: String }],
    lastLoginAt:   { type: Date },
    isActive:      { type: Boolean, default: true  },
    isDeleted:     { type: Boolean, default: false },
    deletedAt:     { type: Date,    default: null  },

    // TripSplit — Cross-Trip Aggregates
    totalOwedAcrossTrips: { type: Number, default: 0, min: 0 },
    totalLentAcrossTrips: { type: Number, default: 0, min: 0 },

    // Social
    friendIds: [{ type: String, ref: 'User' }],

    // Push Notifications
    fcmToken: { type: String, default: null },

    // Preferences & Banking
    preferences:    { type: UserPreferencesSchema, default: () => ({}) },
    bankingDetails: { type: BankingDetailsSchema,  default: () => ({}) },
    stats:          { type: UserStatsSchema,        default: () => ({}) },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: Record<string, any>) => {
        // Strip all sensitive fields — use destructuring, never delete operator
        const {
          refreshTokens,
          __v,
          fcmToken,
          authProviders,
          deletedAt,
          tokenVersion, // Never expose tokenVersion to API clients
          ...safe
        } = ret;
        return safe;
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
          tokenVersion,
          ...safe
        } = ret;
        return safe;
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

// Partial indexes — only index users with non-zero balances
UserSchema.index(
  { totalOwedAcrossTrips: -1 },
  { partialFilterExpression: { totalOwedAcrossTrips: { $gt: 0 } } }
);
UserSchema.index(
  { totalLentAcrossTrips: -1 },
  { partialFilterExpression: { totalLentAcrossTrips: { $gt: 0 } } }
);

// ============================================================
// Pre-Save Middleware
// ============================================================

UserSchema.pre<IUserDocument>('save', function (this: IUserDocument, next: () => void) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  // Guard: don't overwrite deletedAt if already stamped
  if (this.isModified('isDeleted') && this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }
  next();
});

// ============================================================
// Virtuals
// ============================================================

// FIX: Explicitly type `this` as IUserDocument to resolve TS2683
UserSchema.virtual('netBalance').get(function (this: IUserDocument) {
  return (this.totalLentAcrossTrips || 0) - (this.totalOwedAcrossTrips || 0);
});

UserSchema.virtual('friendCount').get(function (this: IUserDocument) {
  return this.friendIds?.length || 0;
});

// ============================================================
// Instance Methods
// ============================================================

// FIX: Explicitly type `this` as IUserDocument on all instance methods
UserSchema.methods.toPublicProfile = function (this: IUserDocument): Record<string, any> {
  return {
    _id:         this._id,
    displayName: this.displayName,
    photoURL:    this.photoURL,
    bio:         this.bio,
    stats: {
      totalGroups:   this.stats?.totalGroups   || 0,
      totalExpenses: this.stats?.totalExpenses || 0,
    },
  };
};

UserSchema.methods.toFullProfile = function (this: IUserDocument): Record<string, any> {
  // toJSON() already strips sensitive fields via the transform above
  return this.toJSON();
};

// ============================================================
// Static Methods
// ============================================================

UserSchema.statics.findActive = function (identifier: string) {
  return this.findOne({
    $or: [
      { _id:         identifier               },
      { firebaseUid: identifier               },
      { email:       identifier.toLowerCase() },
    ],
    isActive:  true,
    isDeleted: false,
  });
};

UserSchema.statics.findByFirebaseUid = function (uid: string) {
  return this.findOne({ firebaseUid: uid, isDeleted: false });
};

UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase(), isDeleted: false });
};

// ============================================================
// Export
// ============================================================

// Double-cast through unknown to resolve type mismatch between
// mongoose.models generic Model and our typed IUserModel
const UserModel = mongoose.models.User
  ? (mongoose.models.User as unknown as IUserModel)
  : mongoose.model<IUserDocument, IUserModel>('User', UserSchema);

export { UserModel as User };
// import mongoose, { Schema, Document, Model } from 'mongoose';
// import { v4 as uuidv4 } from 'uuid';

// // ============================================================
// // Interfaces
// // ============================================================

// export interface IAuthProviders {
//   google?: {
//     id: string;
//     email: string;
//   };
//   apple?: {
//     id: string;
//     email: string;
//   };
//   email?: {
//     verified: boolean;
//     verificationToken?: string;
//     verificationExpires?: Date;
//   };
// }

// export interface INotificationPreferences {
//   push: boolean;
//   email: boolean;
//   sms: boolean;
//   expenseAdded: boolean;
//   settlementReminder: boolean;
//   monthlyReport: boolean;
// }

// export interface IUserPreferences {
//   defaultCurrency: string;
//   language: string;
//   theme: 'light' | 'dark' | 'system';
//   timezone: string;
//   notifications: INotificationPreferences;
// }

// export interface IBankingDetails {
//   upiId?: string;
//   upiVerified?: boolean;
//   bankAccount?: {
//     accountNumber: string;
//     ifscCode: string;
//     bankName: string;
//     accountHolderName: string;
//   };
//   walletDetails?: {
//     provider: 'paytm' | 'phonepe' | 'googlepay' | 'amazonpay';
//     walletId: string;
//   };
// }

// export interface IUserStats {
//   totalGroups: number;
//   totalExpenses: number;
//   totalSettled: number;
//   totalPending: number;
//   lastActiveAt: Date;
//   accountCreatedAt: Date;
// }

// // Clean interface without Mongoose internals
// export interface IUser {
//   [x: string]: any;
//   _id: string;
//   firebaseUid: string;
//   email: string;
//   displayName: string;
//   photoURL?: string;
//   phoneNumber?: string;
//   bio?: string;
  
//   role: 'user' | 'premium' | 'business' | 'admin';
//   authProviders: IAuthProviders;
//   refreshTokens: string[];
//   lastLoginAt?: Date;
//   isActive: boolean;
//   isDeleted: boolean;
//   deletedAt?: Date;
  
//   totalOwedAcrossTrips: number;
//   totalLentAcrossTrips: number;
  
//   friendIds: string[];
//   fcmToken?: string;
  
//   preferences: IUserPreferences;
//   bankingDetails: IBankingDetails;
//   stats: IUserStats;
  
//   createdAt: Date;
//   updatedAt: Date;
// }

// // Mongoose Document — resolves _id type conflict
// export interface IUserDocument extends Omit<IUser, '_id'>, Document<string, any, IUser> {
//   _id: string;
//   toPublicProfile(): Record<string, any>;
//   toFullProfile(): Record<string, any>;
// }

// // Model with static methods
// export interface IUserModel extends Model<IUserDocument> {
//   findActive(identifier: string): Promise<IUserDocument | null>;
//   findByFirebaseUid(uid: string): Promise<IUserDocument | null>;
//   findByEmail(email: string): Promise<IUserDocument | null>;
// }

// // ============================================================
// // Sub-Schemas
// // ============================================================

// const NotificationPreferencesSchema = new Schema<INotificationPreferences>(
//   {
//     push: { type: Boolean, default: true },
//     email: { type: Boolean, default: true },
//     sms: { type: Boolean, default: false },
//     expenseAdded: { type: Boolean, default: true },
//     settlementReminder: { type: Boolean, default: true },
//     monthlyReport: { type: Boolean, default: true },
//   },
//   { _id: false }
// );

// const UserPreferencesSchema = new Schema<IUserPreferences>(
//   {
//     defaultCurrency: { type: String, default: 'INR' },
//     language: { type: String, default: 'en' },
//     theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
//     timezone: { type: String, default: 'Asia/Kolkata' },
//     notifications: { 
//       type: NotificationPreferencesSchema, 
//       default: () => ({
//         push: true,
//         email: true,
//         sms: false,
//         expenseAdded: true,
//         settlementReminder: true,
//         monthlyReport: true,
//       })
//     },
//   },
//   { _id: false }
// );

// const AuthProvidersSchema = new Schema<IAuthProviders>(
//   {
//     google: {
//       type: new Schema(
//         { id: String, email: String },
//         { _id: false }
//       ),
//     },
//     apple: {
//       type: new Schema(
//         { id: String, email: String },
//         { _id: false }
//       ),
//     },
//     email: {
//       type: new Schema(
//         {
//           verified: { type: Boolean, default: false },
//           verificationToken: String,
//           verificationExpires: Date,
//         },
//         { _id: false }
//       ),
//       default: () => ({ verified: false }),
//     },
//   },
//   { _id: false }
// );

// const BankingDetailsSchema = new Schema<IBankingDetails>(
//   {
//     upiId: { type: String, sparse: true },
//     upiVerified: { type: Boolean, default: false },
//     bankAccount: {
//       type: new Schema(
//         {
//           accountNumber: String,
//           ifscCode: String,
//           bankName: String,
//           accountHolderName: String,
//         },
//         { _id: false }
//       ),
//     },
//     walletDetails: {
//       type: new Schema(
//         {
//           provider: { 
//             type: String, 
//             enum: ['paytm', 'phonepe', 'googlepay', 'amazonpay'] 
//           },
//           walletId: String,
//         },
//         { _id: false }
//       ),
//     },
//   },
//   { _id: false }
// );

// const UserStatsSchema = new Schema<IUserStats>(
//   {
//     totalGroups: { type: Number, default: 0 },
//     totalExpenses: { type: Number, default: 0 },
//     totalSettled: { type: Number, default: 0 },
//     totalPending: { type: Number, default: 0 },
//     lastActiveAt: { type: Date, default: Date.now },
//     accountCreatedAt: { type: Date, default: Date.now },
//   },
//   { _id: false }
// );

// // ============================================================
// // Main User Schema
// // ============================================================

// const UserSchema = new Schema<IUserDocument, IUserModel>(
//   {
//     _id: { 
//       type: String, 
//       default: () => uuidv4() // Use function to generate new UUID each time
//     },
//     firebaseUid: { 
//       type: String, 
//       required: true, 
//       unique: true, 
//       index: true 
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       trim: true,
//       index: true,
//     },
//     displayName: { 
//       type: String, 
//       required: true, 
//       trim: true, 
//       maxlength: 100 
//     },
//     photoURL: { type: String },
//     phoneNumber: { 
//       type: String, 
//       index: true, 
//       sparse: true 
//     },
//     bio: { 
//       type: String, 
//       maxlength: 500 
//     },

//     // Role & Auth
//     role: {
//       type: String,
//       enum: ['user', 'premium', 'business', 'admin'],
//       default: 'user',
//     },
//     authProviders: { 
//       type: AuthProvidersSchema, 
//       default: () => ({}) 
//     },
//     refreshTokens: [{ type: String }],
//     lastLoginAt: { type: Date },
//     isActive: { type: Boolean, default: true },
//     isDeleted: { type: Boolean, default: false },
//     deletedAt: { type: Date, default: null },

//     // TripSplit — Cross-Trip Aggregates
//     totalOwedAcrossTrips: { 
//       type: Number, 
//       default: 0, 
//       min: 0 
//     },
//     totalLentAcrossTrips: { 
//       type: Number, 
//       default: 0, 
//       min: 0 
//     },

//     // Social
//     friendIds: [{ 
//       type: String, 
//       ref: 'User' 
//     }],

//     // Push Notifications
//     fcmToken: { 
//       type: String, 
//       default: null 
//     },

//     // Preferences & Banking
//     preferences: { 
//       type: UserPreferencesSchema, 
//       default: () => ({}) 
//     },
//     bankingDetails: { 
//       type: BankingDetailsSchema, 
//       default: () => ({}) 
//     },
//     stats: { 
//       type: UserStatsSchema, 
//       default: () => ({}) 
//     },
//   },
//   {
//     timestamps: true,
//     toJSON: {
//       virtuals: true,
//       // ✅ FIX: Use destructuring instead of delete operator
//       transform: (_doc: any, ret: Record<string, any>) => {
//         const {
//           refreshTokens,
//           __v,
//           fcmToken,
//           authProviders,
//           deletedAt,
//           ...safeRet
//         } = ret;
//         return safeRet;
//       },
//     },
//     toObject: { 
//       virtuals: true,
//       transform: (_doc: any, ret: Record<string, any>) => {
//         const {
//           refreshTokens,
//           __v,
//           fcmToken,
//           authProviders,
//           deletedAt,
//           ...safeRet
//         } = ret;
//         return safeRet;
//       },
//     },
//     versionKey: false,
//   }
// );

// // ============================================================
// // Indexes
// // ============================================================

// UserSchema.index({ email: 1 });
// UserSchema.index({ phoneNumber: 1 }, { sparse: true });
// UserSchema.index({ friendIds: 1 });
// UserSchema.index({ isDeleted: 1, isActive: 1 });
// UserSchema.index({ 'totalOwedAcrossTrips': -1 });
// UserSchema.index({ 'totalLentAcrossTrips': -1 });

// // ============================================================
// // Pre-Save Middleware
// // ============================================================

// UserSchema.pre('save', function (next) {
//   if (this.isModified('email')) {
//     this.email = this.email.toLowerCase().trim();
//   }
//   if (this.isModified('isDeleted') && this.isDeleted) {
//     this.deletedAt = new Date();
//   }
//   next();
// });

// // ============================================================
// // Virtuals
// // ============================================================

// UserSchema.virtual('netBalance').get(function () {
//   return (this.totalLentAcrossTrips || 0) - (this.totalOwedAcrossTrips || 0);
// });

// UserSchema.virtual('friendCount').get(function () {
//   return this.friendIds?.length || 0;
// });

// // ============================================================
// // Instance Methods
// // ============================================================

// UserSchema.methods.toPublicProfile = function () {
//   return {
//     _id: this._id,
//     displayName: this.displayName,
//     photoURL: this.photoURL,
//     bio: this.bio,
//     stats: {
//       totalGroups: this.stats?.totalGroups || 0,
//       totalExpenses: this.stats?.totalExpenses || 0,
//     },
//   };
// };

// UserSchema.methods.toFullProfile = function () {
//   // toJSON already strips sensitive fields
//   const obj = this.toJSON();
//   return obj;
// };

// // ============================================================
// // Static Methods
// // ============================================================

// UserSchema.statics.findActive = function (identifier: string) {
//   return this.findOne({
//     $or: [
//       { _id: identifier },
//       { firebaseUid: identifier },
//       { email: identifier.toLowerCase() },
//     ],
//     isActive: true,
//     isDeleted: false,
//   });
// };

// UserSchema.statics.findByFirebaseUid = function (uid: string) {
//   return this.findOne({ 
//     firebaseUid: uid, 
//     isDeleted: false 
//   });
// };

// UserSchema.statics.findByEmail = function (email: string) {
//   return this.findOne({ 
//     email: email.toLowerCase(), 
//     isDeleted: false 
//   });
// };

// // ============================================================
// // Export
// // ============================================================

// // ============================================================
// // Export
// // ============================================================

// // Use double-cast through unknown to resolve type mismatch
// // mongoose.models.User is a generic Model at runtime but has our static methods
// const UserModel = mongoose.models.User 
//   ? (mongoose.models.User as unknown as IUserModel)
//   : mongoose.model<IUserDocument, IUserModel>('User', UserSchema);

// export { UserModel as User };
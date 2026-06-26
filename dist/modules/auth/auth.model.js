"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const uuid_1 = require("uuid");
// ============================================================
// Sub-Schemas
// ============================================================
const NotificationPreferencesSchema = new mongoose_1.Schema({
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    expenseAdded: { type: Boolean, default: true },
    settlementReminder: { type: Boolean, default: true },
    monthlyReport: { type: Boolean, default: true },
}, { _id: false });
const UserPreferencesSchema = new mongoose_1.Schema({
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
}, { _id: false });
const AuthProvidersSchema = new mongoose_1.Schema({
    google: {
        type: new mongoose_1.Schema({ id: String, email: String }, { _id: false }),
    },
    apple: {
        type: new mongoose_1.Schema({ id: String, email: String }, { _id: false }),
    },
    email: {
        type: new mongoose_1.Schema({
            verified: { type: Boolean, default: false },
            verificationToken: String,
            verificationExpires: Date,
        }, { _id: false }),
        default: () => ({ verified: false }),
    },
}, { _id: false });
const BankingDetailsSchema = new mongoose_1.Schema({
    upiId: { type: String, sparse: true },
    upiVerified: { type: Boolean, default: false },
    bankAccount: {
        type: new mongoose_1.Schema({
            accountNumber: String,
            ifscCode: String,
            bankName: String,
            accountHolderName: String,
        }, { _id: false }),
    },
    walletDetails: {
        type: new mongoose_1.Schema({
            provider: {
                type: String,
                enum: ['paytm', 'phonepe', 'googlepay', 'amazonpay']
            },
            walletId: String,
        }, { _id: false }),
    },
}, { _id: false });
const UserStatsSchema = new mongoose_1.Schema({
    totalGroups: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    totalSettled: { type: Number, default: 0 },
    totalPending: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
    accountCreatedAt: { type: Date, default: Date.now },
}, { _id: false });
// ============================================================
// Main User Schema
// ============================================================
const UserSchema = new mongoose_1.Schema({
    _id: {
        type: String,
        default: () => (0, uuid_1.v4)() // Use function to generate new UUID each time
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
    refreshTokens: [{ type: String }],
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
    friendIds: [{
            type: String,
            ref: 'User'
        }],
    // Push Notifications
    fcmToken: {
        type: String,
        default: null
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
        type: new mongoose_1.Schema({
            count: { type: Number, default: 0 },
            lastRequestAt: { type: Date, default: new Date() },
        }, { _id: false }),
        default: () => ({ count: 0, lastRequestAt: new Date() }),
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        // ✅ FIX: Use destructuring instead of delete operator
        transform: (_doc, ret) => {
            const { refreshTokens, __v, fcmToken, authProviders, deletedAt, ...safeRet } = ret;
            return safeRet;
        },
    },
    toObject: {
        virtuals: true,
        transform: (_doc, ret) => {
            const { refreshTokens, __v, fcmToken, authProviders, deletedAt, ...safeRet } = ret;
            return safeRet;
        },
    },
    versionKey: false,
});
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
UserSchema.statics.findActive = function (identifier) {
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
UserSchema.statics.findByFirebaseUid = function (uid) {
    return this.findOne({
        firebaseUid: uid,
        isDeleted: false
    });
};
UserSchema.statics.findByEmail = function (email) {
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
const UserModel = mongoose_1.default.models.User
    ? mongoose_1.default.models.User
    : mongoose_1.default.model('User', UserSchema);
exports.User = UserModel;
//# sourceMappingURL=auth.model.js.map
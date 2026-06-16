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
exports.UserModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
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
        transform: (doc, ret) => {
            delete ret.__v;
            delete ret._id;
            return ret;
        }
    }
});
// Virtual for full name
UserSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});
// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ 'preferences.defaultCurrency': 1 });
exports.UserModel = mongoose_1.default.models.User || mongoose_1.default.model('User', UserSchema);
//# sourceMappingURL=user.model.js.map
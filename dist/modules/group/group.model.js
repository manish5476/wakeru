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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Group = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const GroupMemberSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
        type: String,
        enum: ['ADMIN', 'MEMBER', 'VIEWER'],
        default: 'MEMBER'
    },
    joinedAt: { type: Date, default: Date.now },
    invitedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    invitationStatus: {
        type: String,
        enum: ['ACCEPTED', 'PENDING', 'DECLINED'],
        default: 'ACCEPTED'
    },
    preferences: {
        customCategory: String,
        colorCode: String,
        notificationSettings: {
            muteGroup: { type: Boolean, default: false },
            muteExpenses: { type: Boolean, default: false }
        }
    },
    balance: {
        totalOwed: { type: mongoose_1.Schema.Types.Decimal128, default: 0 },
        totalLent: { type: mongoose_1.Schema.Types.Decimal128, default: 0 },
        netBalance: { type: mongoose_1.Schema.Types.Decimal128, default: 0 }
    }
});
const GroupSchema = new mongoose_1.Schema({
    groupId: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto_1.default.randomUUID()
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        maxlength: 500
    },
    avatar: String,
    type: {
        type: String,
        enum: ['TRIP', 'HOUSEHOLD', 'TEAM', 'EVENT', 'PROJECT', 'CUSTOM'],
        default: 'CUSTOM'
    },
    members: [GroupMemberSchema],
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    settings: {
        defaultCurrency: { type: String, default: 'INR' },
        defaultSplitType: {
            type: String,
            enum: ['EQUAL', 'PROPORTIONAL'],
            default: 'PROPORTIONAL'
        },
        enableReceiptScanning: { type: Boolean, default: true },
        enableAutoSettlement: { type: Boolean, default: false },
        settlementThreshold: { type: Number, default: 500 },
        allowedPaymentMethods: [{ type: String }],
        categories: [{ type: String }],
        customCategories: [{ type: String }],
        isPublic: { type: Boolean, default: false },
        inviteCode: { type: String, unique: true, sparse: true }
    },
    financialSummary: {
        totalExpenses: { type: Number, default: 0 },
        totalSettled: { type: mongoose_1.Schema.Types.Decimal128, default: 0 },
        totalPending: { type: mongoose_1.Schema.Types.Decimal128, default: 0 },
        lastExpenseDate: Date,
        averageExpenseAmount: { type: mongoose_1.Schema.Types.Decimal128, default: 0 },
        mostActiveMember: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
        expenseCount: { type: Number, default: 0 }
    },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,
    archivedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret.__v;
            return ret;
        }
    }
});
// Indexes
GroupSchema.index({ groupId: 1 });
GroupSchema.index({ 'members.userId': 1 });
GroupSchema.index({ createdBy: 1 });
GroupSchema.index({ 'settings.inviteCode': 1 });
GroupSchema.index({ type: 1, isActive: 1 });
GroupSchema.index({ 'financialSummary.lastExpenseDate': -1 });
// Virtual for member count
GroupSchema.virtual('memberCount').get(function () {
    return this.members.filter(m => m.invitationStatus === 'ACCEPTED').length;
});
// Pre-save hook to generate invite code
GroupSchema.pre('save', function (next) {
    if (this.settings.isPublic && !this.settings.inviteCode) {
        this.settings.inviteCode = crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
    }
    next();
});
exports.Group = mongoose_1.default.models.Group || mongoose_1.default.model('Group', GroupSchema);
//# sourceMappingURL=group.model.js.map
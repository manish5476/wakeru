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
exports.Notification = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const uuid_1 = require("uuid");
// ============================================================
// SUB-SCHEMA
// ============================================================
const ChannelsSchema = new mongoose_1.Schema({
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
}, { _id: false });
// ============================================================
// MAIN SCHEMA
// ============================================================
const NotificationSchema = new mongoose_1.Schema({
    notificationId: {
        type: String,
        required: true,
        unique: true,
        default: () => (0, uuid_1.v4)(),
        index: true,
    },
    userId: {
        type: String, // ✅ String, not ObjectId
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: [
            'EXPENSE_ADDED',
            'EXPENSE_UPDATED',
            'EXPENSE_DELETED',
            'SETTLEMENT_REQUEST',
            'SETTLEMENT_COMPLETED',
            'TRIP_INVITATION',
            'TRIP_JOINED',
            'PAYMENT_REMINDER',
            'MONTHLY_REPORT',
            'STOP_ADDED',
            'EXCHANGE_RATE_UPDATED',
            'FRIEND_REQUEST',
            'FRIEND_ACCEPTED',
            'SYSTEM_UPDATE',
            'SYSTEM',
        ],
        required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 500 },
    data: { type: mongoose_1.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    isActionable: { type: Boolean, default: false },
    actionUrl: { type: String },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
    },
    channels: {
        type: ChannelsSchema,
        default: () => ({
            inApp: true,
            email: false,
            push: false,
            sms: false,
        }),
    },
    readAt: { type: Date },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
});
// ============================================================
// INDEXES
// ============================================================
// Primary query: user's notifications (unread first)
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
// Filter by type
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
// Auto-delete after 30 days (TTL index)
NotificationSchema.index({ createdAt: -1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
// ============================================================
// STATIC METHODS
// ============================================================
NotificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ userId, isRead: false });
};
NotificationSchema.statics.markAllAsRead = async function (userId) {
    return this.updateMany({ userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
};
// ============================================================
// EXPORT
// ============================================================
exports.Notification = mongoose_1.default.model('Notification', NotificationSchema);
//# sourceMappingURL=notification.model.js.map
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// TYPES
// ============================================================

export type NotificationType =
  | 'EXPENSE_ADDED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED'
  | 'SETTLEMENT_REQUEST'
  | 'SETTLEMENT_COMPLETED'
  | 'TRIP_INVITATION'
  | 'TRIP_JOINED'
  | 'PAYMENT_REMINDER'
  | 'MONTHLY_REPORT'
  | 'STOP_ADDED'
  | 'EXCHANGE_RATE_UPDATED';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface INotificationChannels {
  inApp: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface INotification extends Document {
  notificationId: string;
  userId: string;              // Firebase UID / UUID
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;  // TripId, expenseId, etc.
  isRead: boolean;
  isActionable: boolean;
  actionUrl?: string;
  priority: NotificationPriority;
  channels: INotificationChannels;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// SUB-SCHEMA
// ============================================================

const ChannelsSchema = new Schema<INotificationChannels>(
  {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
  },
  { _id: false }
);

// ============================================================
// MAIN SCHEMA
// ============================================================

const NotificationSchema = new Schema<INotification>(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    userId: {
      type: String,              // ✅ String, not ObjectId
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
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 500 },
    data: { type: Schema.Types.Mixed },
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
  }
);

// ============================================================
// INDEXES
// ============================================================

// Primary query: user's notifications (unread first)
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// Filter by type
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Auto-delete after 30 days (TTL index)
NotificationSchema.index(
  { createdAt: -1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

// ============================================================
// STATIC METHODS
// ============================================================

NotificationSchema.statics.getUnreadCount = async function (userId: string) {
  return this.countDocuments({ userId, isRead: false });
};

NotificationSchema.statics.markAllAsRead = async function (userId: string) {
  return this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

// ============================================================
// EXPORT
// ============================================================

export const Notification = mongoose.model<INotification>(
  'Notification',
  NotificationSchema
);
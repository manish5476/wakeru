import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// TYPES
// ============================================================

export type NotificationType =
  // ── EXPENSE EVENTS ───────────────────────────────────────
  | 'EXPENSE_ADDED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED'
  | 'EXPENSE_COMMENT_ADDED'
  | 'EXPENSE_SPLIT_PAID'

  // ── SETTLEMENT EVENTS ────────────────────────────────────
  | 'SETTLEMENT_REQUEST'
  | 'SETTLEMENT_COMPLETED'
  | 'SETTLEMENT_DISPUTED'
  | 'SETTLEMENT_CALCULATED'
  | 'PAYMENT_REMINDER'
  | 'TRIP_FULLY_SETTLED'

  // ── TRIP EVENTS ──────────────────────────────────────────
  | 'TRIP_INVITATION'
  | 'TRIP_INVITATION_ACCEPTED'
  | 'TRIP_INVITATION_DECLINED'
  | 'TRIP_JOIN_REQUEST'
  | 'TRIP_JOIN_APPROVED'
  | 'TRIP_JOIN_REJECTED'
  | 'TRIP_JOINED'
  | 'TRIP_MEMBER_REMOVED'
  | 'TRIP_UPDATED'
  | 'TRIP_ARCHIVED'
  | 'TRIP_COMPLETED'

  // ── STOP EVENTS ──────────────────────────────────────────
  | 'STOP_ADDED'
  | 'STOP_UPDATED'
  | 'STOP_DELETED'
  | 'EXCHANGE_RATE_UPDATED'

  // ── FRIEND EVENTS ────────────────────────────────────────
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'FRIEND_REMOVED'
  | 'FRIEND_BLOCKED'

  // ── SOCIAL / TRIP INVITES ────────────────────────────────
  | 'TRIP_FRIEND_INVITE'
  | 'TRIP_INVITE_RESPONSE'

  // ── BUDGET EVENTS ────────────────────────────────────────
  | 'BUDGET_WARNING'
  | 'BUDGET_EXCEEDED'
  | 'BUDGET_ALERT'

  // ── ACHIEVEMENT EVENTS ───────────────────────────────────
  | 'ACHIEVEMENT_UNLOCKED'
  | 'ACHIEVEMENT_PROGRESS'

  // ── RATE ALERTS ──────────────────────────────────────────
  | 'RATE_ALERT_TRIGGERED'
  | 'RATE_ALERT'

  // ── SMART NOTIFICATIONS ──────────────────────────────────
  | 'FORGOT_EXPENSE_REMINDER'
  | 'WEEKEND_TRIP_REMINDER'
  | 'FRIEND_ACTIVITY'
  | 'SETTLEMENT_REMINDER'

  // ── SYSTEM EVENTS ────────────────────────────────────────
  | 'MONTHLY_REPORT'
  | 'SYSTEM_UPDATE'
  | 'SYSTEM'
  | 'WELCOME'
  | 'ACCOUNT_VERIFICATION'
  | 'PASSWORD_RESET'
  | 'NEW_DEVICE_LOGIN';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type NotificationChannel = 'inApp' | 'email' | 'push' | 'sms';

export interface INotificationChannels {
  inApp: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface INotificationAction {
  label: string;
  action: string;
  value: string;
  icon?: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface INotification extends Document {
  notificationId: string;
  userId: string;                    // Firebase UID
  type: NotificationType;
  title: string;
  message: string;
  body?: string;                     // Rich body (HTML/Markdown)
  data?: Record<string, any>;        // tripId, expenseId, etc.
  isRead: boolean;
  isActionable: boolean;
  actionButtons?: INotificationAction[];
  actionUrl?: string;
  deepLink?: string;                 // Mobile deep link
  priority: NotificationPriority;
  channels: INotificationChannels;
  icon?: string;                     // Emoji or icon name
  imageUrl?: string;                 // Rich notification image
  category?: string;                 // For notification grouping
  ttl?: number;                      // Time-to-live in seconds
  expiresAt?: Date;                  // Auto-delete after this
  readAt?: Date;
  clickedAt?: Date;
  dismissedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  markAsRead(): Promise<void>;
  markAsClicked(): Promise<void>;
  markAsDismissed(): Promise<void>;
  _getDefaultIcon(): string;
}

// ============================================================
// SUB-SCHEMAS
// ============================================================

const ChannelsSchema = new Schema<INotificationChannels>(
  {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
  },
  { _id: false }
);

const ActionButtonSchema = new Schema<INotificationAction>(
  {
    label: { type: String, required: true },
    action: { type: String, required: true },
    value: { type: String, required: true },
    icon: { type: String },
    style: {
      type: String,
      enum: ['primary', 'secondary', 'danger'],
      default: 'primary',
    },
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
      type: String,              // Firebase UID (String, not ObjectId)
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        // Expense Events
        'EXPENSE_ADDED',
        'EXPENSE_UPDATED',
        'EXPENSE_DELETED',
        'EXPENSE_COMMENT_ADDED',
        'EXPENSE_SPLIT_PAID',
        // Settlement Events
        'SETTLEMENT_REQUEST',
        'SETTLEMENT_COMPLETED',
        'SETTLEMENT_DISPUTED',
        'SETTLEMENT_CALCULATED',
        'PAYMENT_REMINDER',
        'TRIP_FULLY_SETTLED',
        // Trip Events
        'TRIP_INVITATION',
        'TRIP_INVITATION_ACCEPTED',
        'TRIP_INVITATION_DECLINED',
        'TRIP_JOIN_REQUEST',
        'TRIP_JOIN_APPROVED',
        'TRIP_JOIN_REJECTED',
        'TRIP_JOINED',
        'TRIP_MEMBER_REMOVED',
        'TRIP_UPDATED',
        'TRIP_ARCHIVED',
        'TRIP_COMPLETED',
        // Stop Events
        'STOP_ADDED',
        'STOP_UPDATED',
        'STOP_DELETED',
        'EXCHANGE_RATE_UPDATED',
        // Friend Events
        'FRIEND_REQUEST',
        'FRIEND_ACCEPTED',
        'FRIEND_REMOVED',
        'FRIEND_BLOCKED',
        // Social / Trip Invites
        'TRIP_FRIEND_INVITE',
        'TRIP_INVITE_RESPONSE',
        // Budget Events
        'BUDGET_WARNING',
        'BUDGET_EXCEEDED',
        'BUDGET_ALERT',
        // Achievement Events
        'ACHIEVEMENT_UNLOCKED',
        'ACHIEVEMENT_PROGRESS',
        // Rate Alerts
        'RATE_ALERT_TRIGGERED',
        'RATE_ALERT',
        // Smart Notifications
        'FORGOT_EXPENSE_REMINDER',
        'WEEKEND_TRIP_REMINDER',
        'FRIEND_ACTIVITY',
        'SETTLEMENT_REMINDER',
        // System Events
        'MONTHLY_REPORT',
        'SYSTEM_UPDATE',
        'SYSTEM',
        'WELCOME',
        'ACCOUNT_VERIFICATION',
        'PASSWORD_RESET',
        'NEW_DEVICE_LOGIN',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    body: {
      type: String,
      maxlength: 2000,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActionable: {
      type: Boolean,
      default: false,
    },
    actionButtons: {
      type: [ActionButtonSchema],
      default: [],
    },
    actionUrl: {
      type: String,
    },
    deepLink: {
      type: String,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    channels: {
      type: ChannelsSchema,
      default: () => ({
        inApp: true,
        email: false,
        push: true,
        sms: false,
      }),
    },
    icon: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    category: {
      type: String,
      index: true,
    },
    ttl: {
      type: Number, // seconds
    },
    expiresAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
    clickedAt: {
      type: Date,
    },
    dismissedAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
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

// Primary query: user's notifications (unread first, newest first)
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// Filter by type
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Filter by priority
NotificationSchema.index({ userId: 1, priority: 1, createdAt: -1 });

// Filter by category
NotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });

// Auto-delete read notifications after 30 days (TTL index)
NotificationSchema.index(
  { readAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

// Auto-delete expired notifications
NotificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// ============================================================
// VIRTUALS
// ============================================================

NotificationSchema.virtual('isExpired').get(function () {
  if (this.expiresAt) {
    return new Date() > this.expiresAt;
  }
  return false;
});

NotificationSchema.virtual('age').get(function () {
  const now = Date.now();
  const created = this.createdAt.getTime();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return this.createdAt.toLocaleDateString();
});

// ============================================================
// PRE-SAVE HOOKS
// ============================================================

NotificationSchema.pre('save', function (next) {
  // Set expiresAt based on TTL
  if (this.ttl && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + this.ttl * 1000);
  }

  // Auto-set channels based on priority
  if (this.priority === 'urgent') {
    this.channels.push = true;
    this.channels.email = true;
  }
  if (this.priority === 'high') {
    this.channels.push = true;
  }

  // Set default icon based on type
  if (!this.icon) {
    this.icon = this._getDefaultIcon();
  }

  next();
});

// ============================================================
// INSTANCE METHODS
// ============================================================

NotificationSchema.methods.markAsRead = async function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
};

NotificationSchema.methods.markAsClicked = async function () {
  if (!this.clickedAt) {
    this.clickedAt = new Date();
    await this.save();
  }
};

NotificationSchema.methods.markAsDismissed = async function () {
  if (!this.dismissedAt) {
    this.dismissedAt = new Date();
    this.isRead = true;
    await this.save();
  }
};

NotificationSchema.methods._getDefaultIcon = function (): string {
  const iconMap: Record<string, string> = {
    // Expense
    EXPENSE_ADDED: '💰',
    EXPENSE_UPDATED: '📝',
    EXPENSE_DELETED: '🗑️',
    EXPENSE_COMMENT_ADDED: '💬',
    EXPENSE_SPLIT_PAID: '✅',
    // Settlement
    SETTLEMENT_REQUEST: '💸',
    SETTLEMENT_COMPLETED: '🎉',
    SETTLEMENT_DISPUTED: '⚠️',
    SETTLEMENT_CALCULATED: '🧮',
    PAYMENT_REMINDER: '⏰',
    TRIP_FULLY_SETTLED: '🏁',
    // Trip
    TRIP_INVITATION: '📨',
    TRIP_INVITATION_ACCEPTED: '✅',
    TRIP_INVITATION_DECLINED: '❌',
    TRIP_JOIN_REQUEST: '🙋',
    TRIP_JOIN_APPROVED: '👍',
    TRIP_JOIN_REJECTED: '👋',
    TRIP_JOINED: '🎊',
    TRIP_MEMBER_REMOVED: '👤',
    TRIP_UPDATED: '✏️',
    TRIP_ARCHIVED: '📦',
    TRIP_COMPLETED: '🏆',
    // Stop
    STOP_ADDED: '📍',
    STOP_UPDATED: '📌',
    STOP_DELETED: '🗺️',
    EXCHANGE_RATE_UPDATED: '💱',
    // Friend
    FRIEND_REQUEST: '🤝',
    FRIEND_ACCEPTED: '🎉',
    FRIEND_REMOVED: '💔',
    FRIEND_BLOCKED: '🚫',
    // Social
    TRIP_FRIEND_INVITE: '🧳',
    TRIP_INVITE_RESPONSE: '📋',
    // Budget
    BUDGET_WARNING: '⚠️',
    BUDGET_EXCEEDED: '🚨',
    BUDGET_ALERT: '📊',
    // Achievement
    ACHIEVEMENT_UNLOCKED: '🏆',
    ACHIEVEMENT_PROGRESS: '📈',
    // Rate Alerts
    RATE_ALERT_TRIGGERED: '💱',
    RATE_ALERT: '📉',
    // Smart
    FORGOT_EXPENSE_REMINDER: '📝',
    WEEKEND_TRIP_REMINDER: '🎉',
    FRIEND_ACTIVITY: '👋',
    SETTLEMENT_REMINDER: '💰',
    // System
    MONTHLY_REPORT: '📊',
    SYSTEM_UPDATE: '🔧',
    SYSTEM: 'ℹ️',
    WELCOME: '👋',
    ACCOUNT_VERIFICATION: '✅',
    PASSWORD_RESET: '🔐',
    NEW_DEVICE_LOGIN: '📱',
  };

  return iconMap[this.type] || '🔔';
};

// ============================================================
// STATIC METHODS
// ============================================================

NotificationSchema.statics.getUnreadCount = async function (userId: string) {
  return this.countDocuments({ userId, isRead: false });
};

NotificationSchema.statics.getUnreadByType = async function (userId: string) {
  return this.aggregate([
    { $match: { userId, isRead: false } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
};

NotificationSchema.statics.markAllAsRead = async function (userId: string) {
  return this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

NotificationSchema.statics.markAsReadByType = async function (
  userId: string,
  type: NotificationType
) {
  return this.updateMany(
    { userId, type, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

NotificationSchema.statics.deleteOldNotifications = async function (
  userId: string,
  olderThanDays: number = 30
) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    userId,
    isRead: true,
    createdAt: { $lt: cutoff },
  });
};

NotificationSchema.statics.getNotificationStats = async function (userId: string) {
  const [total, unread, byType] = await Promise.all([
    this.countDocuments({ userId }),
    this.countDocuments({ userId, isRead: false }),
    this.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] },
          },
        },
      },
      { $sort: { unread: -1 } },
    ]),
  ]);

  return { total, unread, byType };
};

// ============================================================
// EXPORT
// ============================================================

export const Notification = mongoose.model<INotification>(
  'Notification',
  NotificationSchema
);

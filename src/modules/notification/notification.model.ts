import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationDocument extends Document {
  notificationId: string;
  userId: mongoose.Types.ObjectId;
  type: 'EXPENSE_ADDED' | 'EXPENSE_UPDATED' | 'EXPENSE_DELETED' | 
        'SETTLEMENT_REQUEST' | 'SETTLEMENT_COMPLETED' | 'GROUP_INVITATION' |
        'GROUP_JOINED' | 'PAYMENT_REMINDER' | 'MONTHLY_REPORT';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  isActionable: boolean;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  createdAt: Date;
  readAt?: Date;
}

const NotificationSchema = new Schema<INotificationDocument>({
  notificationId: {
    type: String,
    required: true,
    unique: true,
    default: () => `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'EXPENSE_ADDED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED',
      'SETTLEMENT_REQUEST', 'SETTLEMENT_COMPLETED',
      'GROUP_INVITATION', 'GROUP_JOINED',
      'PAYMENT_REMINDER', 'MONTHLY_REPORT'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Schema.Types.Mixed },
  isRead: { type: Boolean, default: false },
  isActionable: { type: Boolean, default: false },
  actionUrl: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  readAt: Date
}, {
  timestamps: true
});

// Indexes for performance
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Auto-delete after 30 days

export const Notification = mongoose.model<INotificationDocument>('Notification', NotificationSchema);
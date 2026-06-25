import mongoose, { Document } from 'mongoose';
export type NotificationType = 'EXPENSE_ADDED' | 'EXPENSE_UPDATED' | 'EXPENSE_DELETED' | 'SETTLEMENT_REQUEST' | 'SETTLEMENT_COMPLETED' | 'TRIP_INVITATION' | 'TRIP_JOINED' | 'PAYMENT_REMINDER' | 'MONTHLY_REPORT' | 'STOP_ADDED' | 'EXCHANGE_RATE_UPDATED' | 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED' | 'SYSTEM_UPDATE' | 'SYSTEM';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export interface INotificationChannels {
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
}
export interface INotification extends Document {
    notificationId: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
    isRead: boolean;
    isActionable: boolean;
    actionUrl?: string;
    priority: NotificationPriority;
    channels: INotificationChannels;
    readAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Notification: mongoose.Model<INotification, {}, {}, {}, mongoose.Document<unknown, {}, INotification, {}, {}> & INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=notification.model.d.ts.map
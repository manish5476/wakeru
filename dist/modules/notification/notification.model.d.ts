import mongoose, { Document } from 'mongoose';
export interface INotificationDocument extends Document {
    notificationId: string;
    userId: mongoose.Types.ObjectId;
    type: 'EXPENSE_ADDED' | 'EXPENSE_UPDATED' | 'EXPENSE_DELETED' | 'SETTLEMENT_REQUEST' | 'SETTLEMENT_COMPLETED' | 'GROUP_INVITATION' | 'GROUP_JOINED' | 'PAYMENT_REMINDER' | 'MONTHLY_REPORT';
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
export declare const Notification: mongoose.Model<INotificationDocument, {}, {}, {}, mongoose.Document<unknown, {}, INotificationDocument, {}, {}> & INotificationDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=notification.model.d.ts.map
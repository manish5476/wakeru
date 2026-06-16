export declare class NotificationService {
    /**
     * Create a notification
     */
    createNotification(userId: string, type: string, title: string, message: string, options?: {
        data?: any;
        isActionable?: boolean;
        actionUrl?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        channels?: Partial<{
            inApp: boolean;
            email: boolean;
            push: boolean;
            sms: boolean;
        }>;
    }): Promise<any>;
    /**
     * Get user's notifications
     */
    getUserNotifications(userId: string, options?: {
        page?: number;
        limit?: number;
        unreadOnly?: boolean;
        type?: string;
    }): Promise<any>;
    /**
     * Mark notification as read
     */
    markAsRead(notificationId: string, userId: string): Promise<any>;
    /**
     * Mark all notifications as read
     */
    markAllAsRead(userId: string): Promise<void>;
    /**
     * Delete notification
     */
    deleteNotification(notificationId: string, userId: string): Promise<void>;
    /**
     * Get unread count
     */
    getUnreadCount(userId: string): Promise<number>;
    /**
     * Send expense notification
     */
    notifyExpenseAdded(groupId: string, expenseId: string, createdBy: string): Promise<void>;
    /**
     * Notify settlement completed
     */
    notifySettlementCompleted(settlement: any): Promise<void>;
    /**
     * Notify payment reminder
     */
    notifyPaymentReminder(fromUserId: string, toUserId: string, amount: number): Promise<void>;
    /**
     * Send monthly report notification
     */
    notifyMonthlyReport(userId: string, reportData: any): Promise<void>;
    /**
     * Send through different channels
     */
    private sendThroughChannels;
    /**
     * Send push notification (placeholder)
     */
    private sendPushNotification;
    /**
     * Send email notification (placeholder)
     */
    private sendEmailNotification;
    /**
     * Send SMS notification (placeholder)
     */
    private sendSMSNotification;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.service.d.ts.map
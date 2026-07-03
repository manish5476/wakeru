interface CreateNotificationOptions {
    data?: Record<string, any>;
    isActionable?: boolean;
    actionUrl?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    channels?: Partial<{
        inApp: boolean;
        email: boolean;
        push: boolean;
        sms: boolean;
    }>;
}
interface NotificationQuery {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
}
export declare class NotificationService {
    /**
     * Create a notification for a user.
     */
    create(userId: string, type: string, title: string, message: string, options?: CreateNotificationOptions): Promise<import("mongoose").Document<unknown, {}, import("./notification.model").INotification, {}, {}> & import("./notification.model").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    /**
     * Get user's notifications (paginated).
     */
    getUserNotifications(userId: string, options?: NotificationQuery): Promise<{
        notifications: (import("mongoose").FlattenMaps<import("./notification.model").INotification> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            pages: number;
            hasMore: boolean;
        };
        unreadCount: number;
    }>;
    /**
     * Mark single notification as read.
     */
    markAsRead(notificationId: string, userId: string): Promise<import("mongoose").Document<unknown, {}, import("./notification.model").INotification, {}, {}> & import("./notification.model").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    /**
     * Mark ALL notifications as read for a user.
     */
    markAllAsRead(userId: string): Promise<void>;
    /**
     * Delete a notification.
     */
    delete(notificationId: string, userId: string): Promise<void>;
    /**
     * Clear ALL notifications.
     */
    clearAll(userId: string): Promise<void>;
    /**
     * Get unread count.
     */
    getUnreadCount(userId: string): Promise<number>;
    /**
     * Notify all trip members (except the actor) about a new expense.
     */
    notifyExpenseAdded(tripId: string, expenseId: string, actorUid: string): Promise<void>;
    /**
     * Notify about settlement request.
     */
    notifySettlementRequest(fromUid: string, toUid: string, amount: number, baseCurrency: string, tripId: string): Promise<void>;
    /**
     * Notify about completed settlement.
     */
    notifySettlementCompleted(fromUid: string, toUid: string, amount: number, baseCurrency: string, tripId: string): Promise<void>;
    /**
     * Notify user about trip invitation.
     */
    notifyTripInvitation(toUid: string, tripId: string, tripTitle: string, inviterName: string): Promise<void>;
    /**
     * Notify trip members that someone joined.
     */
    notifyTripJoined(tripId: string, joinerUid: string): Promise<void>;
    /**
     * Notify user about payment reminder.
     */
    notifyPaymentReminder(fromUid: string, toUid: string, amount: number, baseCurrency: string, tripId: string): Promise<void>;
    /**
     * Broadcast an app update / system notification to all active users.
     */
    broadcastSystemUpdate(link: string): Promise<void>;
    private sendThroughChannels;
    private sendPush;
    private sendEmail;
    private sendSMS;
}
export declare const notificationService: NotificationService;
export {};
//# sourceMappingURL=notification.service.d.ts.map
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class NotificationController {
    /**
     * Get notifications
     */
    getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get unread count
     */
    getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Mark as read
     */
    markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Mark all as read
     */
    markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Delete notification
     */
    deleteNotification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const notificationController: NotificationController;
//# sourceMappingURL=notification.controller.d.ts.map
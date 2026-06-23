import { Response, NextFunction } from 'express';
export declare class NotificationController {
    getNotifications(req: any, res: Response, next: NextFunction): Promise<void>;
    getUnreadCount(req: any, res: Response, next: NextFunction): Promise<void>;
    markAsRead(req: any, res: Response, next: NextFunction): Promise<void>;
    markAllAsRead(req: any, res: Response, next: NextFunction): Promise<void>;
    deleteNotification(req: any, res: Response, next: NextFunction): Promise<void>;
    broadcastAppUpdate(req: any, res: Response, next: NextFunction): Promise<void>;
}
export declare const notificationController: NotificationController;
//# sourceMappingURL=notification.controller.d.ts.map
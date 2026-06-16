"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = exports.NotificationController = void 0;
const notification_service_1 = require("./notification.service");
class NotificationController {
    /**
     * Get notifications
     */
    async getNotifications(req, res, next) {
        try {
            const { page, limit, unreadOnly, type } = req.query;
            const result = await notification_service_1.notificationService.getUserNotifications(req.user.userId, {
                page: Number(page) || 1,
                limit: Number(limit) || 20,
                unreadOnly: unreadOnly === 'true',
                type: type
            });
            const response = {
                success: true,
                message: 'Notifications retrieved successfully',
                data: result,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get unread count
     */
    async getUnreadCount(req, res, next) {
        try {
            const count = await notification_service_1.notificationService.getUnreadCount(req.user.userId);
            const response = {
                success: true,
                message: 'Unread count retrieved successfully',
                data: { unreadCount: count },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Mark as read
     */
    async markAsRead(req, res, next) {
        try {
            const { notificationId } = req.params;
            await notification_service_1.notificationService.markAsRead(notificationId, req.user.userId);
            const response = {
                success: true,
                message: 'Notification marked as read',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Mark all as read
     */
    async markAllAsRead(req, res, next) {
        try {
            await notification_service_1.notificationService.markAllAsRead(req.user.userId);
            const response = {
                success: true,
                message: 'All notifications marked as read',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete notification
     */
    async deleteNotification(req, res, next) {
        try {
            const { notificationId } = req.params;
            await notification_service_1.notificationService.deleteNotification(notificationId, req.user.userId);
            const response = {
                success: true,
                message: 'Notification deleted',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.NotificationController = NotificationController;
exports.notificationController = new NotificationController();
//# sourceMappingURL=notification.controller.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = exports.NotificationController = void 0;
const notification_service_1 = require("./notification.service");
const AppError_1 = require("../../shared/errors/AppError");
// ============================================================
// HELPER
// ============================================================
const getUser = (req) => {
    if (!req.user?.userId)
        throw new AppError_1.AppError('Not authenticated', 401);
    return req.user.userId;
};
// ============================================================
// CONTROLLER
// ============================================================
class NotificationController {
    async getNotifications(req, res, next) {
        try {
            const userId = getUser(req);
            const { page, limit, unreadOnly, type } = req.query;
            const result = await notification_service_1.notificationService.getUserNotifications(userId, {
                page: Number(page) || 1,
                limit: Number(limit) || 20,
                unreadOnly: unreadOnly === 'true',
                type: type,
            });
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getUnreadCount(req, res, next) {
        try {
            const userId = getUser(req);
            const count = await notification_service_1.notificationService.getUnreadCount(userId);
            res.status(200).json({
                success: true,
                data: { unreadCount: count },
            });
        }
        catch (error) {
            next(error);
        }
    }
    async markAsRead(req, res, next) {
        try {
            const userId = getUser(req);
            await notification_service_1.notificationService.markAsRead(req.params.notificationId, userId);
            res.status(200).json({
                success: true,
                message: 'Notification marked as read',
            });
        }
        catch (error) {
            next(error);
        }
    }
    async markAllAsRead(req, res, next) {
        try {
            const userId = getUser(req);
            await notification_service_1.notificationService.markAllAsRead(userId);
            res.status(200).json({
                success: true,
                message: 'All notifications marked as read',
            });
        }
        catch (error) {
            next(error);
        }
    }
    async deleteNotification(req, res, next) {
        try {
            const userId = getUser(req);
            await notification_service_1.notificationService.delete(req.params.notificationId, userId);
            res.status(200).json({
                success: true,
                message: 'Notification deleted',
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.NotificationController = NotificationController;
exports.notificationController = new NotificationController();
//# sourceMappingURL=notification.controller.js.map
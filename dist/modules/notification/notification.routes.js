"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("./notification.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.protect);
// Get notifications (with pagination & filters)
router.get('/', notification_controller_1.notificationController.getNotifications.bind(notification_controller_1.notificationController));
// Get unread count
router.get('/unread-count', notification_controller_1.notificationController.getUnreadCount.bind(notification_controller_1.notificationController));
// Mark all as read
router.post('/read-all', notification_controller_1.notificationController.markAllAsRead.bind(notification_controller_1.notificationController));
// Mark single as read
router.patch('/:notificationId/read', notification_controller_1.notificationController.markAsRead.bind(notification_controller_1.notificationController));
// Admin Broadcast
router.post('/admin/broadcast-update', notification_controller_1.notificationController.broadcastAppUpdate.bind(notification_controller_1.notificationController));
// Clear all notifications
router.delete('/clear-all', notification_controller_1.notificationController.clearAll.bind(notification_controller_1.notificationController));
// Delete notification
router.delete('/:notificationId', notification_controller_1.notificationController.deleteNotification.bind(notification_controller_1.notificationController));
exports.default = router;
//# sourceMappingURL=notification.routes.js.map
import { Router } from 'express';
import { notificationController } from './notification.controller';
import { protect, AuthMiddleware } from '../auth/auth.middleware';

const router = Router();
router.use(protect);

// Admin-only app update routes
router.get('/admin/check-permission', AuthMiddleware.authorize('admin'), notificationController.checkAdminPermission);
router.post('/admin/broadcast-update', AuthMiddleware.authorize('admin'), notificationController.broadcastAppUpdate);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/stats', notificationController.getNotificationStats);
router.post('/read-all', notificationController.markAllAsRead);
router.post('/read-by-type', notificationController.markAsReadByType);
router.post('/:notificationId/read', notificationController.markAsRead);
router.delete('/clear-all', notificationController.clearAll);
router.delete('/:notificationId', notificationController.deleteNotification);
router.post('/delete-old', notificationController.deleteOld);

export default router;

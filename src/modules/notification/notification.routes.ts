import { Router } from 'express';
import { notificationController } from './notification.controller';
import { protect } from '../auth/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// Get notifications (with pagination & filters)
router.get('/', notificationController.getNotifications.bind(notificationController));

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));

// Mark all as read
router.post('/read-all', notificationController.markAllAsRead.bind(notificationController));

// Mark single as read
router.patch('/:notificationId/read', notificationController.markAsRead.bind(notificationController));

// Admin Broadcast
router.post('/admin/broadcast-update', notificationController.broadcastAppUpdate.bind(notificationController));

// Clear all notifications
router.delete('/clear-all', notificationController.clearAll.bind(notificationController));

// Delete notification
router.delete('/:notificationId', notificationController.deleteNotification.bind(notificationController));

export default router;
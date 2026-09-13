import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { AppError } from '../../shared/errors/AppError';
import { config } from '../../config';

const getUser = (req: Request) => {
  const user = (req as any).user;
  // ✅ FIXED: Notification.userId is stored as Firebase UID, not UUID _id
  if (!user?.firebaseUid) throw new AppError('Not authenticated', 401);
  return user.firebaseUid;
};

export const notificationController = {
  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { page, limit, unreadOnly, type, category, priority } = req.query;
      
      const result = await notificationService.getUserNotifications(userId, {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        unreadOnly: unreadOnly === 'true',
        type: type as string,
        category: category as string,
        priority: priority as string,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const count = await notificationService.getUnreadCount(userId);
      res.status(200).json({ success: true, data: { unreadCount: count } });
    } catch (err) { next(err); }
  },

  async getNotificationStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const stats = await notificationService.getNotificationStats(userId);
      res.status(200).json({ success: true, data: stats });
    } catch (err) { next(err); }
  },

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { notificationId } = req.params;
      const notification = await notificationService.markAsRead(notificationId, userId);
      res.status(200).json({ success: true, data: { notification } });
    } catch (err) { next(err); }
  },

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      await notificationService.markAllAsRead(userId);
      res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (err) { next(err); }
  },

  async markAsReadByType(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { type } = req.body;
      await notificationService.markAsReadByType(userId, type);
      res.status(200).json({ success: true, message: `All ${type} notifications marked as read` });
    } catch (err) { next(err); }
  },

  async deleteNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { notificationId } = req.params;
      await notificationService.delete(notificationId, userId);
      res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (err) { next(err); }
  },

  async clearAll(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      await notificationService.clearAll(userId);
      res.status(200).json({ success: true, message: 'All notifications cleared' });
    } catch (err) { next(err); }
  },

  async deleteOld(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { olderThanDays, days } = req.body;
      const daysToDelete = olderThanDays || days || 30;
      await notificationService.deleteOldNotifications(userId, daysToDelete);
      res.status(200).json({ success: true, message: 'Old notifications deleted' });
    } catch (err) { next(err); }
  },

  async checkAdminPermission(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user || user.role !== 'admin') {
        throw new AppError('Admin permission required', 403);
      }
      const isOwner = (user.email || '').toLowerCase().trim() === config.OWNER_EMAIL.toLowerCase();
      res.status(200).json({
        success: true,
        data: {
          isOwner,
          role: user.role,
          canBroadcast: true,
          adminEmail: user.email,
        },
      });
    } catch (err) { next(err); }
  },

  async broadcastAppUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user || user.role !== 'admin') {
        throw new AppError('Admin permission required to broadcast updates', 403);
      }

      const { version, title, message, link, forceUpdate } = req.body;
      if (!link) {
        throw new AppError('Download / update link is required', 400);
      }

      const updateTitle = title || `🚀 New App Version ${version || ''} Available!`.trim();
      const updateMessage = message || 'A new version of Wakeru has been released. Update now for the latest features and improvements.';

      // Realtime websocket broadcast to all active connected sockets
      socketServer.broadcastToAll('app:update_broadcast', {
        type: 'APP_UPDATE',
        version: version || 'latest',
        title: updateTitle,
        message: updateMessage,
        link,
        forceUpdate: !!forceUpdate,
        timestamp: new Date().toISOString(),
      });

      // Persist notifications for all active users
      await notificationService.broadcastSystemUpdate(updateTitle, updateMessage, link);

      res.status(200).json({
        success: true,
        message: 'App update broadcasted successfully to all users.',
        data: {
          version: version || 'latest',
          title: updateTitle,
          link,
          broadcastedAt: new Date().toISOString(),
        },
      });
    } catch (err) { next(err); }
  },
};
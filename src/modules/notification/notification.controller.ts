import { Response, NextFunction } from 'express';
import { notificationService } from './notification.service';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { AppError } from '../../shared/errors/AppError';

// ============================================================
// HELPER
// ============================================================

const getUser = (req: any) => {
  if (!req.user?.userId) throw new AppError('Not authenticated', 401);
  return req.user.userId;
};

// ============================================================
// CONTROLLER
// ============================================================

export class NotificationController {
  
  async getNotifications(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      const { page, limit, unreadOnly, type } = req.query;

      const result = await notificationService.getUserNotifications(userId, {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        unreadOnly: unreadOnly === 'true',
        type: type as string,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      const count = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      await notificationService.markAsRead(req.params.notificationId, userId);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      await notificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteNotification(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUser(req);
      await notificationService.delete(req.params.notificationId, userId);

      res.status(200).json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  async broadcastAppUpdate(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      // Basic security check for testing
      const { password, link } = req.body;
      if (password !== 'msms5476mmmm') {
        res.status(403).json({ success: false, message: 'Invalid admin password' });
        return;
      }
      
      if (!link) {
        res.status(400).json({ success: false, message: 'Link is required' });
        return;
      }

      socketServer.broadcastToAll('app:update_broadcast', {
        type: 'APP_UPDATE',
        link,
        timestamp: new Date().toISOString(),
      });

      // Also persist it for all active users
      await notificationService.broadcastSystemUpdate(link);

      res.status(200).json({
        success: true,
        message: 'App update broadcasted successfully to all connected users.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
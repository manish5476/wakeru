import { Response, NextFunction } from 'express';
import { notificationService } from './notification.service';
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
}

export const notificationController = new NotificationController();
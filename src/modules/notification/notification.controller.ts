import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';

export class NotificationController {
  /**
   * Get notifications
   */
  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, unreadOnly, type } = req.query;
      
      const result = await notificationService.getUserNotifications(req.user!.userId, {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        unreadOnly: unreadOnly === 'true',
        type: type as string
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await notificationService.getUnreadCount(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        data: { unreadCount: count },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark as read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notificationId } = req.params;
      await notificationService.markAsRead(notificationId, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Notification marked as read',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAllAsRead(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'All notifications marked as read',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notificationId } = req.params;
      await notificationService.deleteNotification(notificationId, req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Notification deleted',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
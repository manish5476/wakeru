import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';
import { AppError } from '../../shared/errors/AppError';

const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.userId) throw new AppError('Not authenticated', 401);
  return user.userId;
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
};




// import { Response, NextFunction } from 'express';
// import { notificationService } from './notification.service';
// import { socketServer } from '../../infrastructure/websocket/socket.server';
// import { AppError } from '../../shared/errors/AppError';

// // ============================================================
// // HELPER
// // ============================================================

// const getUser = (req: any) => {
//   if (!req.user?.userId) throw new AppError('Not authenticated', 401);
//   return req.user.userId;
// };

// // ============================================================
// // CONTROLLER
// // ============================================================

// export class NotificationController {
  
//   async getNotifications(req: any, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const userId = getUser(req);
//       const { page, limit, unreadOnly, type } = req.query;

//       const result = await notificationService.getUserNotifications(userId, {
//         page: Number(page) || 1,
//         limit: Number(limit) || 20,
//         unreadOnly: unreadOnly === 'true',
//         type: type as string,
//       });

//       res.status(200).json({ success: true, data: result });
//     } catch (error) {
//       next(error);
//     }
//   }

//   async getUnreadCount(req: any, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const userId = getUser(req);
//       const count = await notificationService.getUnreadCount(userId);

//       res.status(200).json({
//         success: true,
//         data: { unreadCount: count },
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   async markAsRead(req: any, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const userId = getUser(req);
//       await notificationService.markAsRead(req.params.notificationId, userId);

//       res.status(200).json({
//         success: true,
//         message: 'Notification marked as read',
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   async markAllAsRead(req: any, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const userId = getUser(req);
//       await notificationService.markAllAsRead(userId);

//       res.status(200).json({
//         success: true,
//         message: 'All notifications marked as read',
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   async deleteNotification(req: any, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const userId = getUser(req);
//       await notificationService.delete(req.params.notificationId, userId);

//       res.status(200).json({
//         success: true,
//         message: 'Notification deleted',
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   async clearAll(req: any, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const userId = getUser(req);
//       await notificationService.clearAll(userId);

//       res.status(200).json({
//         success: true,
//         message: 'All notifications cleared',
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   async broadcastAppUpdate(req: any, res: Response, next: NextFunction): Promise<void> {
//     try {
//       // Basic security check for testing
//       const { password, link } = req.body;
//       if (password !== 'msms5476mmmm') {
//         res.status(403).json({ success: false, message: 'Invalid admin password' });
//         return;
//       }
      
//       if (!link) {
//         res.status(400).json({ success: false, message: 'Link is required' });
//         return;
//       }

//       socketServer.broadcastToAll('app:update_broadcast', {
//         type: 'APP_UPDATE',
//         link,
//         timestamp: new Date().toISOString(),
//       });

//       // Also persist it for all active users
//       await notificationService.broadcastSystemUpdate(link);

//       res.status(200).json({
//         success: true,
//         message: 'App update broadcasted successfully to all connected users.',
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// export const notificationController = new NotificationController();
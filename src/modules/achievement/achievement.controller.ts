import { Request, Response, NextFunction } from 'express';
import { achievementService } from './achievement.service';
import { AppError } from '../../shared/errors/AppError';

const getUser = (req: Request) => {
    const user = (req as any).user;
    if (!user?.firebaseUid) throw new AppError('Not authenticated', 401);
    return user.firebaseUid; // ✅ FIXED: Use Firebase UID
};

export const achievementController = {
    async getMyAchievements(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const result = await achievementService.getUserAchievements(userId);
            res.status(200).json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async getNotifications(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const notifications = await achievementService.getAchievementNotifications(userId);
            res.status(200).json({ success: true, data: { notifications, unreadCount: notifications.length } });
        } catch (err) { next(err); }
    },

    async markNotificationsRead(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { notificationIds } = req.body;
            await achievementService.markNotificationsRead(userId, notificationIds);
            res.status(200).json({ success: true, message: 'Notifications marked as read' });
        } catch (err) { next(err); }
    },

    async getTripLeaderboard(req: Request, res: Response, next: NextFunction) {
        try {
            const { tripId } = req.params;
            const leaderboard = await achievementService.getTripLeaderboard(tripId);
            res.status(200).json({ success: true, data: { leaderboard } });
        } catch (err) { next(err); }
    },
};
import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';
import { redisClient } from '../../config/redis';

export const dashboardController = {
    async getDashboard(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.firebaseUid;
            const { type } = req.query;
            const cacheKey = `dashboard:${userId}:${type || 'default'}`;
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({
                    success: true,
                    data: JSON.parse(cachedData),
                    cached: true
                });
            }
            const data = await dashboardService.getDashboard(userId, type as string);
            await redisClient.set(cacheKey, JSON.stringify(data), 60);
            res.status(200).json({ success: true, data, cached: false });
        } catch (err) { next(err); }
    },
};
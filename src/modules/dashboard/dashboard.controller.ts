import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
    async getDashboard(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const data = await dashboardService.getDashboard(userId);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },
};
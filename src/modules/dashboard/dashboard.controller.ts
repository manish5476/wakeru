import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
    async getDashboard(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.firebaseUid;
            const { type } = req.query;
            const data = await dashboardService.getDashboard(userId, type as string);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },
};